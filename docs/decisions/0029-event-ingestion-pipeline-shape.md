# ADR 0029: Event Ingestion Pipeline Shape

Status: accepted

The app generates three categories of events that need to be persisted for analytics, safety, and revenue reporting: proximity buzz events, reveal events, and promo engagement events. This ADR decides how those events travel from the app to the database.

## Decision

**Inline synchronous writes to Postgres for M2.** Each event is written in the same request handler that processes the action. No queue, no async worker, no separate ingestion service.

| Event | Trigger | Table |
|---|---|---|
| `buzz_sent` | `POST /api/buzz` succeeds | `app.buzz_events` |
| `reveal_requested` | `POST /api/reveals` — PENDING created | `app.reveal_events` |
| `reveal_matched` | `POST /api/reveals` — MATCHED transition | `app.reveal_events` |
| `promo_impression` | Client fires `POST /api/promos/:id/impression` on geofence entry | `app.promo_events` |
| `promo_tap` | Client fires `POST /api/promos/:id/tap` | `app.promo_events` |

### Schema additions

```sql
CREATE TABLE app.buzz_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id    UUID NOT NULL REFERENCES app.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app.reveal_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reveal_id    UUID NOT NULL REFERENCES app.reveals(id),
  event_type   TEXT NOT NULL CHECK (event_type IN ('requested', 'matched', 'expired')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app.promo_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES app.users(id),
  promo_id     UUID NOT NULL REFERENCES app.promos(id),
  event_type   TEXT NOT NULL CHECK (event_type IN ('impression', 'tap')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON app.buzz_events (created_at);
CREATE INDEX ON app.reveal_events (reveal_id);
CREATE INDEX ON app.promo_events (promo_id, event_type);
```

No user location is stored in any event table. `sender_id` in `buzz_events` is anonymised in admin reporting (city/area only per ADR 0010 privacy rules).

### Why inline writes are sufficient for M2

M2 is a closed beta. Event volume will be low (hundreds per day, not millions). Inline writes add ~2–5ms per request, which is imperceptible. The complexity cost of a queue (BullMQ, Redis streams, or SQS) is not justified until sustained throughput exceeds ~500 events/second — a problem M2 will not have.

## Alternatives considered

**Redis Streams as a lightweight queue** — decouples ingestion from the request path. Deferred to M3: adds operational complexity (stream consumer process, backpressure handling) with no benefit at M2 scale.

**Write-only append log (immutable Kafka-style)** — future-proof for analytics. Rejected for M2: over-engineered. The existing `audit.entries` pattern (ADR 0009) proves Postgres handles append-only event workloads at this scale.

**Client-side event batching** — app batches events locally and flushes every 30 seconds. Rejected: adds retry complexity, makes debugging harder, and the per-event network cost at M2 scale is negligible.

## Consequences

- Three new tables added to `db-setup.sql`.
- Existing `POST /api/buzz` route gains an event write (already has the `sender_id` in scope).
- `POST /api/reveals` route (ADR 0025) writes reveal events at PENDING creation and MATCHED transition.
- Two new lightweight endpoints: `POST /api/promos/:id/impression` and `POST /api/promos/:id/tap`.
- Admin Revenue page can query `app.promo_events` for engagement metrics.
- Migration path to a queue in M3: extract the inline writes to a producer interface and swap the implementation without changing callers.
