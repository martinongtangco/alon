# ADR 0007: Real-Time Transport for Admin Dashboard

Status: Accepted
Date: 2026-04-25

## Context

[docs/spec/admin-dashboard-spec.md](../spec/admin-dashboard-spec.md) requires real-time updates for several views:

- **System Status Bar** — auto-refresh every 15s, shown on every page (line 67)
- **Live Activity** — refresh every 5s, with a streaming event log (lines 98–110)
- **System Logs** — live tail of structured events (lines 287–311)

Spec line 385: *"Real-time features (Live Activity, status bar) use WebSocket or SSE — not polling."*

The traffic shape is **server → client only**. Admins do not stream data back to the server in real time. They issue discrete REST requests (suspend user, kill promo, edit config). There is no need for bidirectional persistent transport.

The [admin-dashboard-recommendations.md](../../ImplementationPlanMd/admin-dashboard-recommendations.md) chose WebSocket and dismissed SSE in one line. This ADR overrides that choice with a real comparison.

## Decision

**Server-Sent Events (SSE) over HTTP/2.**

One SSE endpoint per logical stream:
- `GET /api/v1/admin/stream/status` — system health ticks every 15s
- `GET /api/v1/admin/stream/activity` — Live Activity metrics + event log, ticks every 5s
- `GET /api/v1/admin/stream/logs?level=...` — structured log lines, filtered server-side

Each connection is authenticated via a short-lived signed stream token (passed as a query param) issued from a `POST /api/v1/admin/stream/token` endpoint that validates the admin's JWT. EventSource (the browser SSE client) cannot send custom Authorization headers, hence the token-in-query pattern. Stream tokens are bound to a single admin session and expire after 5 minutes; the browser auto-reconnects with a fresh token on EventSource error.

Events are JSON-encoded with a discriminated `type` field:

```
event: status
data: {"type":"status","services":[{"name":"BLE","state":"healthy"}, ...]}

event: activity_tick
data: {"type":"activity_tick","activeSessions":1234, ...}
```

## Alternatives considered

1. **WebSocket** (proposed in implementation recommendations) — bidirectional and lower-overhead per message, but:
   - We have no client-to-server real-time messages. The bidirectionality is unused capacity.
   - Requires upgrade negotiation at the proxy/load-balancer layer; some managed proxies (e.g., default API Gateway HTTP endpoints) handle WS but with extra config. SSE is plain HTTP.
   - No native auto-reconnect-with-resume; we'd write our own. EventSource has built-in `Last-Event-ID` resume.
   - Auth via query-param token is awkward there too — not an SSE-only problem.
2. **Long polling** — explicitly rejected by spec line 385.
3. **Polling with `If-Modified-Since`** — rejected. The 5s tick on Live Activity would generate continuous request churn for every admin tab open. SSE one-connection-per-stream is cheaper per active admin.
4. **GraphQL subscriptions** — would require introducing GraphQL. Rejected per [ADR 0005](0005-admin-dashboard-backend-topology.md).

## Consequences

- Each open admin tab holds 1–3 long-lived HTTP connections (status, activity, optionally logs). Backend connection pool sizing must account for this. With ~20 ops staff and 2 tabs each, that is ~120 concurrent SSE connections — trivial for Node + a properly configured load balancer.
- HTTP/2 multiplexing means multiple streams share one TCP connection per admin tab. We require HTTP/2 termination at the load balancer (managed cloud load balancers all support this).
- Server-side stream lifecycle: each handler must heartbeat (a comment line every 15–30s) to keep proxies from killing idle connections. Standard pattern, but easy to forget.
- Reconnection on the client is automatic via EventSource. Engineers do not need to write custom reconnect logic — they only need to ensure the `Last-Event-ID` resumption works for the activity log stream (idempotent replay from cursor).
- If a future feature genuinely needs bidirectional real-time (collaborative editing of platform config, e.g.), we revisit with a new ADR. v1 doesn't have that.
- Admin-side client uses the native `EventSource` API directly. No additional library required.

## Implementation notes

- SSE endpoints must set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, and `X-Accel-Buffering: no` (defeats nginx buffering if it's in the path).
- Heartbeat: emit `: ping\n\n` every 20s.
- Server should disable response compression on SSE endpoints (compression buffers, defeating real-time).
- Event payloads must be small. Anything chunky (full log dumps) goes via REST + pagination, not SSE.
- The Live Activity event log stream emits anonymized events only per spec line 110. No user IDs in stream payloads.
