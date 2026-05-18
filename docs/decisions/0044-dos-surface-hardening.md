# ADR 0044: DoS Surface Hardening

Status: Accepted
Date: 2026-05-18
Milestone: M3 (security — ship before public deployment)
Depends on: [ADR 0015](0015-app-api-topology.md), [ADR 0039](0039-request-body-validation.md)

## Context

The security audit identified several endpoints that can be abused for denial-of-service attacks by authenticated devices:

**M3 — Unbounded token array on `GET /api/nearby`.**
`backend/src/routes/app/nearby.ts` accepts `tokens` from `req.body?.tokens ?? req.query.tokens` with no length cap. An authenticated device can submit hundreds or thousands of fake tokens, causing a Redis pipeline of `GET` calls for each, followed by a bulk PostgreSQL `ANY($1)` query with potentially thousands of UUIDs. This is an amplification attack: a small request causes a large backend work unit.

**M7 — Pagination `limit` parameter is uncapped.**
`backend/src/routes/admin/users.ts`, `businesses.ts`, `flags.ts`, and `audit.ts` all pass `req.query.limit` directly to `LIMIT $n` in SQL with no maximum. An authenticated admin can pass `limit=1000000` and trigger a full-table scan and transfer. Even without malicious intent, a misconfigured dashboard pagination component could cause this.

**L4 — `GET /api/matches` silently returns `[]` on DB error.**
`backend/src/routes/app/matches.ts` catch block returns `{ data: [] }` with status 200 when the database is unavailable. The client cannot distinguish "no matches" from "database is down." This masks infrastructure failures and could cause a user's match list to silently disappear during an outage.

**L8 — No request body size limit** (also addressed in ADR 0040, consolidated here for completeness).
Body size limit is already handled in ADR 0040's `express.json({ limit: '64kb' })`. No additional action required in this ADR.

## Decision

### 1. Cap the `tokens` array on `/api/nearby` (M3)

The `NearbySchema` in `backend/src/schemas/app.ts` (created in ADR 0039) already caps `tokens` at 50 UUIDs:

```ts
export const NearbySchema = z.object({
  tokens: z.array(z.string().uuid()).max(50),
});
```

With ADR 0039 implemented, this cap is enforced by Zod validation before the handler runs. No additional change needed in the route handler itself.

However, add an explicit comment in `backend/src/routes/app/nearby.ts` explaining the cap rationale:

```ts
// Token array is capped at 50 by NearbySchema (ADR 0039/0044).
// BLE scan in a realistic environment produces at most ~20-30 visible tokens.
// 50 is a generous ceiling that prevents Redis pipeline amplification.
```

If `validate(NearbySchema)` has not been applied yet (i.e., ADR 0039 is not yet implemented), add a manual guard as a temporary measure:

```ts
const tokens: string[] = (req.body?.tokens ?? req.query.tokens ?? []).slice(0, 50);
```

This ADR is dependent on ADR 0039 and should be implemented alongside it or after it.

### 2. Cap pagination `limit` on all admin list endpoints (M7)

Create a shared pagination helper in `backend/src/utils/pagination.ts`:

```ts
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export function parsePagination(query: Record<string, unknown>): { limit: number; offset: number } {
  const raw = Number(query.limit);
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

  const rawOffset = Number(query.offset);
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  return { limit, offset };
}
```

Replace all direct `req.query.limit` and `req.query.offset` accesses in the following files with `parsePagination(req.query)`:

- `backend/src/routes/admin/users.ts`
- `backend/src/routes/admin/businesses.ts`
- `backend/src/routes/admin/flags.ts`
- `backend/src/routes/admin/audit.ts`
- `backend/src/routes/admin/promos.ts` (check if paginated)
- `backend/src/routes/admin/events.ts` (check if paginated)

Example replacement:

```ts
// BEFORE
const limit = parseInt(req.query.limit as string) || 50;
const offset = parseInt(req.query.offset as string) || 0;

// AFTER
import { parsePagination } from '../../utils/pagination';
const { limit, offset } = parsePagination(req.query);
```

The admin dashboard UI currently uses 50 as its page size, which is within the 100-item cap. No dashboard changes needed.

### 3. Return proper error status on DB failure in matches endpoint (L4)

In `backend/src/routes/app/matches.ts`, change the catch block to return HTTP 503 instead of a silent 200:

```ts
// BEFORE
} catch {
  return res.json({ data: [] });
}

// AFTER
} catch (err) {
  console.error('[matches] db error:', err);
  return res.status(503).json({ error: 'Service temporarily unavailable' });
}
```

**Client-side handling (`app/src/state/store.ts`):**
`fetchMatches()` in the Zustand store currently catches errors and ignores them:

```ts
fetchMatches: async () => {
  try {
    const matches = await apiService.fetchMatches();
    set({ matches });
  } catch {
    // ignore errors — handled by empty fallback
  }
},
```

Update the catch block to preserve the existing matches rather than silently not updating:

```ts
fetchMatches: async () => {
  try {
    const matches = await apiService.fetchMatches();
    set({ matches });
  } catch {
    // Do not overwrite existing matches on error — preserve stale data.
    // The server returns 503 on DB failure; the client retains last known state.
    console.warn('[matches] fetch failed — retaining cached matches');
  }
},
```

This change is a no-op for the success path. On failure, the user sees their last known matches rather than an empty list. The store comment is updated to document the intent.

## Files to create or modify

| File | Change |
|---|---|
| `backend/src/utils/pagination.ts` | Create — `parsePagination()` helper |
| `backend/src/routes/admin/users.ts` | Use `parsePagination()` |
| `backend/src/routes/admin/businesses.ts` | Use `parsePagination()` |
| `backend/src/routes/admin/flags.ts` | Use `parsePagination()` |
| `backend/src/routes/admin/audit.ts` | Use `parsePagination()` |
| `backend/src/routes/admin/promos.ts` | Use `parsePagination()` if paginated |
| `backend/src/routes/admin/events.ts` | Use `parsePagination()` if paginated |
| `backend/src/routes/app/nearby.ts` | Add comment; ensure `validate(NearbySchema)` is applied (ADR 0039 dependency) |
| `backend/src/routes/app/matches.ts` | Change catch to return HTTP 503 |
| `app/src/state/store.ts` | Update `fetchMatches` catch block comment |

## Alternatives considered

**Per-endpoint manual limit cap** — doing `Math.min(limit, 100)` in each route handler works but duplicates logic. A shared `parsePagination()` utility is cleaner and more maintainable. Rejected as inferior.

**Remove `offset`-based pagination in favour of cursor pagination** — cursor pagination is more robust for large datasets. For M3 with a small user base and admin-only access, offset pagination is acceptable. Deferred to a future ADR if admin tables grow beyond tens of thousands of rows.

**Return stale matches from cache on 503** — the Zustand `persist` middleware already keeps the last known state in AsyncStorage. The correct behaviour is to not overwrite good state with an error state. Accepted.

**Raise the token cap above 50** — the BLE scanner in a realistic environment sees at most 20-30 peers at once. 50 is already generous. Higher values provide no product value and increase Redis pipeline size. Rejected.

## Consequences

- Admin dashboard pagination is now capped at 100 items per page. If the dashboard has any "load all" functionality that passes a very large limit, it will silently be capped at 100. Verify the admin dashboard doesn't rely on getting more than 100 records in a single request.
- Matches endpoint now returns HTTP 503 on DB failure instead of HTTP 200 with empty data. Any client code that checks for empty arrays to detect "no matches" must be updated to also handle 503. The Zustand store change above handles this correctly.
- The nearby token cap (50) is enforced at the Zod validation layer. Clients submitting more than 50 tokens receive HTTP 400. The mobile app's BLE scanner should never produce more than 50 simultaneous tokens in normal operation.
