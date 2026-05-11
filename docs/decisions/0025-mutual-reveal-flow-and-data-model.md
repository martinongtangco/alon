# ADR 0025: Mutual Reveal Flow and Data Model

Status: accepted

M1 has no identity surfacing. M2 introduces the ability for two users who are physically near and mutually interested to reveal their display name and photo to each other. This ADR defines the state machine, the API contract, and the database schema for reveals. There is no chat at any point in this flow — the app's job ends at the reveal.

## Decision

### State machine

A reveal has four states:

```
INTERESTED → PENDING → MATCHED → (terminal)
                     ↘ EXPIRED
```

- **INTERESTED** — local only, never sent to server. User taps "Reveal" while peer is in Very Near band. The app records intent locally (Zustand) and sends a reveal request to the server.
- **PENDING** — server has received one side's request; waiting for the other side. TTL: 24 hours. If the peer does not reveal within 24 hours the record expires and both sides see nothing.
- **MATCHED** — both sides have revealed. Server notifies both via push (ADR 0027). Display name + photo URL become visible in the Matches screen.
- **EXPIRED** — TTL elapsed with only one-sided reveal. Record is soft-deleted (status column). No notification sent.

A MATCHED record is permanent — it does not expire. Users can only delete their own side via the Profile screen (removes them from the other user's Matches view too).

### Database schema

New table in the `app` schema:

```sql
CREATE TABLE app.reveals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiator_id    UUID NOT NULL REFERENCES app.users(id),
  target_id       UUID NOT NULL REFERENCES app.users(id),
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'MATCHED', 'EXPIRED')),
  initiated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE (initiator_id, target_id)
);

CREATE INDEX ON app.reveals (target_id, status);
CREATE INDEX ON app.reveals (expires_at) WHERE status = 'PENDING';
```

Mutual detection: when `POST /api/reveals` is called, check if a PENDING row already exists with `initiator_id = :target` and `target_id = :me`. If yes, update both rows to MATCHED and set `matched_at`. This is a single transaction.

### API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/reveals` | device JWT | Send a reveal request. Body: `{ targetToken: string }` |
| `GET` | `/api/reveals/matches` | device JWT | List all MATCHED reveals for the current user |
| `DELETE` | `/api/reveals/:id` | device JWT | Remove a match (soft-delete own side) |

`targetToken` is the peer's proximity token (not their user ID — the server resolves token → user via Redis, ADR 0014).

### Frontend

- **Matches screen** (`app/src/screens/Matches/`) — lists MATCHED reveals with display name + photo. Already in the nav.
- **Radar screen** — "Reveal" button appears only when a compatible peer (ADR 0024) is in the Very Near band. Single tap sends the reveal request. No confirmation step (low stakes, reversible via Matches screen).
- **No chat UI anywhere.** The Matches screen shows name + photo and nothing else. No message input, no typing indicator, no read receipt.

## Alternatives considered

**Real-time mutual detection via SSE** — server pushes MATCHED event immediately when the second reveal lands. Deferred to M2+: requires the app to hold an open SSE connection, which has battery cost. For M2, a short poll on app foreground is sufficient.

**Store reveal intent server-side immediately** — even before the peer is in range, the user can "flag" interest. Rejected: creates a stalking vector. Reveal requests are only accepted when the peer's token is active in Redis (i.e., currently nearby).

## Consequences

- `app.reveals` table added to `db-setup.sql`.
- Three new app-facing API routes added to `backend/src/routes/app/`.
- Each reveal mutation uses `withAudit()` — add `REVEAL_REQUEST`, `REVEAL_MATCHED`, `REVEAL_REMOVED` to the `AuditAction` enum.
- A background job (cron or Postgres-native `pg_cron`) expires PENDING rows past `expires_at`. For M2 this can be a startup sweep on backend boot; a proper scheduler is M3.
