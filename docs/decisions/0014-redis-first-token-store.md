# ADR 0014: Redis-First Token Store (M1), Postgres Supplement (M2)

Status: Accepted
Date: 2026-05-03
Supplements: [ADR 0006](0006-primary-database-selection.md)

## Context

[ADR 0006](0006-primary-database-selection.md) selected PostgreSQL + PostGIS as the primary application database. That decision was made in the context of the admin dashboard, which has relational workloads (users joined to flags, businesses joined to promos, etc.).

Milestone 1 has a different workload: device registration and proximity token issuance only. No user profiles, no relational queries, no geo joins. The token store is a pure key-value + TTL problem:

- `SET token:{uuid} device_id EX 930` (15-minute token + 30-second grace window per ADR 0011)
- `GET token:{uuid}` on proximity event to resolve device identity
- `DEL token:{uuid}` on Ghost Mode activation (M3)

Standing up a full PostgreSQL instance for M1 adds schema migration tooling, connection pooling, and operational overhead for a workload that Redis handles natively in a single command.

## Decision

**M1: Redis only.** No Postgres in Milestone 1.

**M2: Add Postgres** when persistent user profiles are required (display name, Vibe selections, profile photo reference, mutual reveal state, match history).

ADR 0006 remains the authoritative long-term database decision. This ADR covers only the phased introduction.

## Alternatives considered

1. **Postgres from day one** — correct long-term, but adds schema design, migration tooling, and connection pooling to M1 scope. The token store does not need relational structure. Rejected for M1.
2. **Redis only, permanently** — Redis as the primary store for user profiles is an anti-pattern. User profiles require ACID guarantees, complex queries, and durable persistence that Redis does not provide reliably. Rejected as a permanent strategy.
3. **SQLite for M1** — zero-ops, embedded, but not suitable for a cloud-deployed service with concurrent connections. Rejected.

## Consequences

- M1 backend depends only on Redis. Deployment is: Node/Express process + Redis instance. Railway and Fly.io both support this with minimal configuration.
- Proximity token data is ephemeral by design — Redis is appropriate. No token data needs to survive a Redis restart in M1.
- M2 introduces a Postgres migration. User profiles written during the M1 lab test will not persist — acceptable for a 2-device internal test.
- When Postgres is added in M2, the token store can remain in Redis. There is no requirement to move it to Postgres; the hybrid (Redis for tokens, Postgres for profiles) is the intended long-term state per ADR 0006 §Alternatives considered, option 3.
