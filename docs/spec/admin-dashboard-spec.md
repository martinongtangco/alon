# Alon — Admin Dashboard Specification

## Overview

The **Admin Dashboard** is the internal backend management web application for the Alon operations and engineering team. It is the single control plane for the entire platform — user management, partner oversight, content moderation, revenue tracking, system health monitoring, and platform configuration.

It is not accessible to end users or partner businesses. Access is restricted to Alon staff with assigned admin roles.

> If the Business Portal is the partner's cockpit, the Admin Dashboard is the control tower.

---

## Users

**Super Admin**: Full access to all sections including platform config, feature flags, and user bans. Typically engineering leads or founders.

**Ops / Moderation**: Access to users, flags, businesses, promos, and events. Cannot touch platform config or billing internals.

**Finance**: Access to revenue section and billing data only.

Role-based access control (RBAC) is a v1 requirement — not a post-launch addition. Different admin roles must see different navigation items.

---

## Authentication

- Separate login from the Business Portal — admin.Alon (or equivalent internal URL)
- Email + password with mandatory 2FA (TOTP)
- Session timeout after 30 minutes of inactivity
- All admin actions are logged to an audit trail (who did what, when)

---

## Navigation Structure

```
Alon Admin Dashboard
├── Overview               Platform-wide stats, system status bar, pending actions
├── Live Activity          Real-time session counts, event log, mode distribution
├── Users                  Full user table — search, filter, view, moderate
├── Flags & Reports        Moderation queue — flagged profiles, promos, buzzes
├── Businesses             Partner management — approve, suspend, edit
├── Promos                 Platform-wide promo oversight — flag, pause, kill
├── Events                 Event moderation — approve community submissions, feature
├── Revenue                MRR, transactions, plan breakdown
├── System Logs            Live and historical server log stream
└── Platform Config        Proximity engine settings, promo rules, feature flags
```

---

## Features

### 1. System Status Bar

A persistent bar at the top of every page (below the topbar) showing the live health of all major platform services. Always visible regardless of which page is active.

**Services monitored:**
- API (core backend)
- BLE Engine (proximity broadcast service)
- Promo CMS
- Push Notifications (Firebase/APNs)
- Database

Each service shows one of three states: Healthy (green dot), Degraded (amber dot), Down (red dot). Clicking a service opens the relevant section of the System Logs page.

**Last sync timestamp** is shown at the right edge — auto-refreshes every 15 seconds.

---

### 2. Platform Overview

The landing page after login. Designed for a daily standup or a quick health check.

**Platform-wide metric cards:**
- Total registered users
- Active sessions (last 15 minutes)
- Partner businesses
- Live promos (across all partners)
- MRR

**Daily Active Users chart** — trailing 7 days, bar chart. No interactivity in v1.

**Platform Health panel** — progress bars for key performance indicators:
- API response time (p95 target: <200ms)
- BLE broadcast success rate (target: >99%)
- Push notification delivery rate (target: >98%)
- DB query time (avg)
- Promo CDN latency

**New Business Signups — Pending Review** — a compact table of partner accounts awaiting approval. Allows one-click access to the review modal without navigating to the Businesses section.

**Recent Flags** — the 5 most recent open flags from the moderation queue, with severity and a quick-link to the Flags page.

---

### 3. Live Activity

Real-time view of platform activity. Refreshes automatically every 5 seconds.

**Live metric cards:**
- Active sessions
- BLE devices currently broadcasting
- Buzzes per minute
- Promos triggered per minute
- API requests per second

**Active users by mode** — a live breakdown of Networking / Chill / Dating / Explorer session counts with progress bars showing relative distribution.

**Live event log** — a streaming tail of significant platform events: buzz signals sent, mutual reveals, promo triggers, push failures, new sessions, rate-limit hits. Anonymized — no user IDs in this view, only anonymized references.

---

### 4. Users

Full user management. The primary tool for the moderation and ops team.

**Table columns:**
- User display (avatar initials + truncated name)
- Internal user ID (anonymized token shown, not raw PII unless admin has PII access role)
- Current mode (Networking / Chill / Dating / Explorer)
- Active Vibes
- Plan (Free / Alon Pro)
- Status (Active / Ghost / Flagged / Suspended / Banned)
- Last active timestamp
- Platform (iOS / Android)
- Actions

**Filters:** All / Alon Pro / Ghost Mode / Flagged / Banned / iOS / Android

**Search:** By display name, internal user ID, or email (email search restricted to Super Admin role).

**Actions per user:**
- View full profile (read-only)
- Rate limit (throttle buzz and promo redemption activity)
- Suspend (temporary — user can appeal)
- Ban (permanent — irreversible from UI, requires Super Admin)
- Clear flags (dismiss open reports)

**User privacy guardrails:**
- Exact GPS coordinates are never shown in the admin UI — only city/area
- Photos and bios are viewable only in the context of reviewing a flag, not in the general user table
- All PII access is logged in the audit trail

---

### 5. Flags & Reports

The moderation queue. Every report submitted by users in the mobile app lands here.

**Tab states:** Open / In Review / Resolved

**Flag card fields:**
- Severity (High / Medium / Low — system-assigned based on report type and volume)
- Type (Profile Report / Promo Fraud / Buzz Spam / Content / Other)
- Timestamp and subject (user ID or business ID being reported)
- Report count (how many distinct users reported this)
- Summary of the reported content
- Action buttons

**Actions per flag:**
- View subject (opens user or business profile in a side panel)
- Dismiss (close with no action — logged)
- Warn subject (sends an in-app warning — not yet in v1 scope)
- Suspend / Ban user
- Kill promo (immediately deactivates a flagged promo)
- Escalate (marks as requiring Super Admin review)
- Mark Resolved

**Auto-flagging rules** (configured in Platform Config):
- Buzz rate above N per minute → auto-flag as Buzz Spam
- Promo redemptions above M% of limit in under X minutes → auto-flag as Promo Fraud
- N distinct user reports on same subject → auto-escalate to High severity

---

### 6. Businesses

Partner account management. The primary tool for approving new partners and handling account issues.

**Table columns:**
- Business name (with avatar initials)
- Category
- Plan (Basic / Pro / Enterprise)
- Status (Active / Pending / Suspended / Cancelled)
- City/area
- Active promo count
- MRR contribution
- Join date
- Actions

**Filters:** All / Active / Pending Review / Suspended / by Plan tier

**Search:** By business name, city, or contact email.

**Actions per business:**
- Edit (admin can override plan, adjust radius limits, edit notes)
- Approve (for Pending accounts — triggers welcome email to partner)
- Reject (for Pending accounts — triggers rejection email, reason required)
- Suspend (immediately deactivates all promos and events, partner sees suspension notice)
- Reinstate (lift suspension)
- View portal session (read-only audit view of partner's activity)

**Business review modal** (triggered on Approve):
- Displays submitted business info (name, category, address, contact, plan selected)
- Admin notes field (internal, not visible to partner)
- Plan override selector (admin can change the plan before activation)
- Approve & Activate or Reject buttons

---

### 7. Promos

Platform-wide view of all promos across all partner accounts. Oversight and moderation tool — not a content creation tool (partners create promos in the Business Portal).

**Table columns:**
- Promo headline
- Business name
- Broadcast radius
- Redemption count
- Redemption limit
- Status (Active / Paused / Flagged / Expired)
- Created date
- Actions

**Filters:** All / Active / Paused / Pending Approval / Expired / Flagged

**Actions per promo:**
- View (read-only detail)
- Pause (deactivates broadcast — partner is notified)
- Kill (permanently ends the promo — use for fraud/abuse cases)
- Flag (adds to moderation queue)

**Promo fraud indicators** (surfaced visually in the table):
- Redemption limit set to unlimited (highlighted in red)
- Redemption rate anomaly (e.g. 800 redemptions in 2 hours on a 100/day limit)
- Radius exceeding plan limits (configuration error — should be caught at creation but shown here as a safety net)

---

### 8. Events

Moderation and curation of all events in the Nearby Feed — both partner-submitted and community-submitted.

**Table columns:**
- Event name
- Organizer (partner business or "Community")
- Date/time
- Vibe tags
- Estimated reach (user count in the event's Vibe + location intersection)
- Status (Scheduled / Live / Ended / Pending Review / Rejected)
- Featured toggle (admin can feature or un-feature any event)
- Actions

**Community-submitted events** require manual approval before appearing in the feed. Partner events on verified accounts auto-approve (configurable in Platform Config).

**Actions per event:**
- Edit (admin can correct details, change Vibe tags, adjust date)
- Approve (for community submissions)
- Reject (with required reason — shown to submitter)
- Feature / Un-feature (toggles paid boost placement without charging)
- Remove (immediately delists from the feed)

---

### 9. Revenue

Financial overview for the ops and finance team. Read-only — no billing actions are taken from this screen.

**Metric cards:**
- MRR total
- Partner subscription revenue (broken down by plan)
- Alon Pro (user subscriptions) revenue
- Event boost revenue (one-time charges)
- Brand activation revenue

**Revenue by plan panel** — progress bars showing each plan tier's contribution to total MRR, with business count.

**Recent Transactions table** — last 20 transactions: business/user name, plan or product, amount, date. Links to the full transaction in the payment gateway (Stripe or equivalent).

**Period selector**: Current month / Prior month / Quarter to date.

**Export**: CSV of all transactions for the selected period.

---

### 10. System Logs

Structured log stream for the engineering and ops team.

**Log levels:** INFO / WARN / ERROR — color-coded (blue / amber / red).

**Filter by level**: All / Errors only / Warnings / Info.

**Log line format:**
```
[timestamp]  [LEVEL]  message  ·  key=value pairs
```

**Download**: Exports the current filtered view as a `.log` file.

**Log categories visible:**
- BLE broadcast ticks
- Promo triggers and redemptions (anonymized)
- Push notification delivery and failures
- Mutual reveal completions
- Rate limit triggers
- Auto-flag events
- Business registration events
- Auth events (login, 2FA, failed attempts)
- DB health checks

Raw server logs (with full stack traces) are available only through the cloud provider console, not in this UI.

---

### 11. Platform Config

Live configuration for platform behavior. Changes take effect immediately unless flagged as requiring a deploy. **Super Admin only.**

A warning banner is shown at the top of this page at all times: *Changes here affect live app behavior for all users. Verify before saving.*

**Proximity Engine settings:**

| Setting | Description | Default |
|---|---|---|
| BLE Scan Interval (ms) | How often the BLE scanner cycles | 220 |
| Buzz Cooldown (seconds) | Minimum time between buzz signals from same user | 30 |
| Max Promo Broadcast Radius (m) | Hard ceiling across all plans | 200 |
| Ghost Mode BLE Behavior | What halts when Ghost Mode is on | Full halt |
| UWB Enabled | Toggle Ultra-Wideband on supported hardware | On |

**Promo Rules:**

| Setting | Description | Default |
|---|---|---|
| Min Promo Radius (m) | Lowest a partner can set | 25 |
| Max Radius — Basic Plan (m) | Enforced upper limit for Basic tier | 75 |
| Max Radius — Pro Plan (m) | Enforced upper limit for Pro tier | 200 |
| Max Redemption Limit | Hard ceiling on any single promo's cap | 10,000 |
| Require Admin Approval for New Promos | All partner promos go through review before going live | Off |

**Moderation Settings:**

| Setting | Description | Default |
|---|---|---|
| Auto-flag buzz rate (per min) | Trigger a flag if user sends N buzzes/min | 8 |
| Reports before auto-suspension | Distinct user reports to trigger automatic account hold | 5 |
| Auto-suspend flagged accounts | Whether the system acts or just queues | On |
| Email admin on High severity flags | Immediate email alert | On |

**Feature Flags:**

| Flag | Description |
|---|---|
| Visualizer | Full-screen accelerometer art mode |
| Dating Mode | Enable dating-specific discovery mode |
| Community Event Submissions | Non-partner users can submit events |
| Brand Activation Campaigns | Enterprise geo-fenced brand campaigns |
| Alon Pro Subscriptions | User-facing Pro tier purchases |

All config changes are logged to the audit trail with the admin's identity and a before/after diff.

---

## Design Principles

- **Function over form — but still legible.** This is an internal tool. It prioritizes information density over polish, but it should not look like it was built in an afternoon.
- **Dark-mode only.** Consistent with the Alon brand and easier on ops staff during late-night incident response.
- **Destructive actions are hard to trigger accidentally.** Ban, Kill, Suspend all require a second confirmation step. Nothing irreversible happens on a single click.
- **Every action leaves a trace.** The audit log captures who did what. No stealth edits.
- **Status is always visible.** The system status bar is persistent — an ops person should never have to navigate anywhere to know if something is down.

---

## Technical Notes

- Web application — no native app
- Desktop-primary; tablet-readable but not mobile-optimized
- Authentication: email + password + mandatory TOTP 2FA
- Session timeout: 30 minutes idle
- RBAC: Super Admin / Ops+Moderation / Finance — enforced server-side, not just UI-hidden
- All admin API endpoints require an admin-scoped JWT separate from the partner or user JWTs
- Audit log is append-only and stored separately from the main application DB
- Real-time features (Live Activity, status bar) use WebSocket or SSE — not polling

---

## Audit Log Requirements

Every state-changing action taken by an admin must be logged with:
- Admin user ID and role
- Timestamp (UTC)
- Action type
- Subject (user ID, business ID, promo ID, etc.)
- Before state → After state (where applicable)
- IP address of the admin session

Audit logs are retained for a minimum of 12 months. They are read-only — no admin can delete or modify audit entries.

---

## Out of Scope (v1)

- Multi-region dashboard (single-region deployment assumed at launch)
- Automated refund processing (handled manually via payment gateway console)
- Partner communication tools (email campaigns, announcements) from within the dashboard
- AI-assisted moderation (auto-classification of flagged content)
- Public status page for partner-facing uptime visibility
- A/B test management for app features

---

## Open Questions — Resolved 2026-04-25

Previously open questions have been resolved. Decisions are recorded in ADRs; rationale is summarised here for spec continuity.

**1. RBAC model — exactly which roles?**
v1 ships with exactly three roles: **Super Admin**, **Ops / Moderation**, and **Finance**, as described above in §Users. The data model uses a role enum so additional roles can be added without a schema migration. No additional roles are in scope for v1. See [ADR 0008](../decisions/0008-admin-auth-rbac.md).

**2. Audit log — dashboard UI or log aggregator only?**
Both. A read-only Audit Log page (Super Admin only) is accessible within the dashboard, providing filtered browsing and CSV export. Separately, entries are mirrored asynchronously to a structured log aggregator for long-term archival and cross-system incident search. The PostgreSQL table is the authoritative source; the aggregator is secondary. See [ADR 0009](../decisions/0009-audit-log-architecture.md).

**3. Admin access revocation when a team member offboards?**
A Super Admin deactivates the admin account record. On deactivation: all active refresh tokens for that admin are immediately invalidated via a DB flag check on every token refresh; any in-flight access tokens expire naturally within 15 minutes (access token TTL). Deactivation is logged to the audit trail. No self-service offboarding — requires another Super Admin to act. See [ADR 0008](../decisions/0008-admin-auth-rbac.md).

**4. Partner Review notifications — Slack or email?**
**Email only for v1.** New business approval triggers a welcome email to the partner; rejection triggers a rejection email with required reason. Internal ops team notification is also email (configurable recipient list). Slack integration is a post-v1 enhancement — it introduces a dependency on a third-party webhook and out-of-band configuration that is out of scope for launch.

**5. Platform Config — zero-downtime for all settings?**
Not all. Settings fall into two tiers:

| Tier | Behaviour | Examples |
|---|---|---|
| **Hot** — takes effect immediately, no deploy | Config value read from DB on each use | BLE Scan Interval, Buzz Cooldown, Promo radius limits, Auto-flag thresholds, Feature flags |
| **Warm** — requires process restart, not a full deploy | Value read at process startup | JWT signing keys, DB connection strings |
| **Cold** — requires a deploy | Structural changes | New feature flag entries, schema changes to config format |

Hot-tier settings cover all settings listed in §Platform Config. The warning banner on that page remains accurate: changes to hot-tier settings affect live app behaviour immediately.

---

*Last updated: 2026-04-25 — Open questions resolved; ADRs 0004–0009 drafted*
*Reference implementation: `alon_admin_dashboard.html`*
