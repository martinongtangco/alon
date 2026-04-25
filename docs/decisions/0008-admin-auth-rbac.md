# ADR 0008: Admin Authentication and RBAC

Status: Accepted
Date: 2026-04-25

## Context

[docs/spec/admin-dashboard-spec.md](../spec/admin-dashboard-spec.md) mandates:

- Email + password with **mandatory TOTP 2FA** (line 29)
- Session timeout after **30 minutes of inactivity** (line 30)
- **Separate login** from the Business Portal (line 28)
- Admin API endpoints require an **admin-scoped JWT separate** from partner or user JWTs (line 383)
- **RBAC enforced server-side**, not just UI-hidden (line 382)
- Three roles: **Super Admin**, **Ops / Moderation**, **Finance** (lines 15–20)
- **All admin actions logged** to an audit trail (line 31)

The mobile and partner JWTs are issued by their own auth flows. The admin JWT must be a distinct token with a distinct signing key and `iss` claim, such that a stolen mobile JWT cannot be replayed against admin endpoints.

Per spec open question resolution (see [admin-dashboard-spec.md](../spec/admin-dashboard-spec.md) §Open Questions, now resolved): v1 RBAC ships with exactly the three roles listed. The architecture uses a role enum so additional roles can be added without schema migration.

## Decision

**JWT-based auth with separate admin signing key + TOTP (otplib) + role enum enforced in middleware.**

### Token model

| Token | TTL | Storage |
|---|---|---|
| Access token (JWT) | 15 minutes | Memory only (JS variable) — never `localStorage` |
| Refresh token (opaque) | 8 hours, invalidated on idle >30 min | `HttpOnly` secure cookie |
| TOTP session token | 5 minutes, single-use | `HttpOnly` secure cookie, consumed on 2FA completion |

JWT claims:
```json
{
  "iss": "vibr8me-admin",
  "sub": "<admin_user_id>",
  "role": "SUPER_ADMIN" | "OPS" | "FINANCE",
  "iat": ...,
  "exp": ...
}
```

Signing: RS256 (asymmetric). Admin service holds the private key; public key is published to a JWKS endpoint for any future service that needs to verify admin tokens without calling home.

### Login flow

```
1. POST /api/v1/admin/auth/login   { email, password }
   → verify bcrypt hash
   → if valid: issue TOTP session token (cookie), respond 200 { totp_required: true }

2. POST /api/v1/admin/auth/totp    { code }   (requires TOTP session cookie)
   → verify TOTP code via otplib
   → invalidate TOTP session token
   → issue access JWT (response body) + refresh token (HttpOnly cookie)
   → log auth event to audit

3. Subsequent requests: Authorization: Bearer <access_token>
   → authAdmin middleware verifies signature + expiry + iss claim
   → attaches { adminId, role } to request context

4. POST /api/v1/admin/auth/refresh  (requires refresh cookie)
   → validate refresh token in DB (not expired, not revoked, last_active < 30 min)
   → update last_active
   → issue new access JWT
   → on idle >30 min: invalidate refresh token, return 401 (forces re-login)
```

### RBAC

Role enum: `SUPER_ADMIN | OPS | FINANCE`

Server-side middleware: `requireRole(...roles: Role[])` — mounts after `authAdmin`. Any route that is restricted to a specific role uses this middleware explicitly.

| Section | Allowed roles |
|---|---|
| Overview, Live Activity, Users, Flags, Businesses, Promos, Events | SUPER_ADMIN, OPS |
| Revenue | SUPER_ADMIN, FINANCE |
| System Logs | SUPER_ADMIN, OPS |
| Platform Config | SUPER_ADMIN only |
| User email search | SUPER_ADMIN only (spec line 128) |
| Ban (permanent) | SUPER_ADMIN only (spec line 137) |
| All config changes | SUPER_ADMIN only (spec line 319) |

The frontend reads `role` from the decoded access token and hides navigation items accordingly — but the server enforces the same restrictions independently. UI visibility and server enforcement are both required; neither substitutes for the other.

### Admin user provisioning

Admin accounts are created by a Super Admin via the `/api/v1/admin/users` endpoint (not a self-registration flow). TOTP setup is mandatory at first login (TOTP enrollment link delivered by email, expires in 24 hours). Access revocation: a Super Admin deactivates the account record; all refresh tokens for that admin are immediately invalidated via a DB flag check on every refresh. Deactivation is logged to the audit trail.

## Alternatives considered

1. **Auth0 / Clerk / third-party identity provider** — valid for customer-facing auth. For an internal admin tool of this sensitivity, we prefer owning the credential and session store rather than depending on a third party's breach posture. Revisit if the team grows and SSO (SAML/OIDC) with an identity provider (Okta, Google Workspace) becomes necessary.
2. **Session cookies only (no JWT)** — simpler, but the SSE stream auth would require the same query-param token workaround regardless (see [ADR 0007](0007-admin-realtime-transport.md)). JWT in memory + refresh cookie gives the same security surface with a cleaner API contract.
3. **HS256 (symmetric JWT signing)** — any service that can verify tokens can also forge them. RS256 means only the admin service can issue tokens; verification is key-independent.
4. **Storing access token in `localStorage`** — rejected. Vulnerable to XSS. Memory-only access token with HttpOnly refresh cookie is the standard mitigation.
5. **Coarse role model (single admin role)** — spec requires RBAC as a v1 requirement, not post-launch (line 21). Finance staff must not see moderation queues; ops staff must not touch Platform Config. Not optional.

## Consequences

- Admin users need a provisioning flow (Super Admin creates accounts). This is a feature to implement before any other admin can log in — it's a bootstrap dependency.
- TOTP enrollment on first login requires email delivery. The backend needs a transactional email sender for enrollment links and rejection notifications. Library: Nodemailer with a configured SMTP provider (SendGrid, Postmark — final provider selection is ops, not architecture).
- RS256 requires managing a key pair. In production: inject private key via environment variable (not committed to repo). Public key embedded or served from JWKS endpoint.
- Refresh token DB table must have an index on `(admin_user_id, last_active)` for efficient revocation checks on every token refresh.
- Session idle enforcement (30 min) is a server-side check on `last_active` — it is not solely a client-side timer. A client that holds an access token past expiry gets 401; a client that holds a valid refresh token but hasn't refreshed in >30 min also gets 401 on next refresh attempt.

## Implementation notes

- Library: `jose` (JOSE standard, well-maintained, TypeScript native) for JWT signing/verification.
- TOTP: `otplib` with default TOTP algorithm (SHA-1, 30s step, 6 digits) — this is RFC 6238 standard, compatible with Google Authenticator, Authy, 1Password, etc.
- Password hashing: `bcrypt` with cost factor 12.
- All auth events (login success, login failure, 2FA success, 2FA failure, logout, token refresh, account deactivation) must be written to the audit log. See [ADR 0009](0009-audit-log-architecture.md).
