# ADR 0017: Deployment Platform (M1)

Status: Accepted
Date: 2026-05-03
Closes: open decision — "cloud from day one" declared in [ADR 0012](0012-milestone-1-product-scope.md)

## Context

[ADR 0012](0012-milestone-1-product-scope.md) committed to cloud deployment from day one: "No hardcoded UUIDs. Ship the real architecture."

[ADR 0014](0014-redis-first-token-store.md) defines the M1 stack as: **Node/Express process + Redis instance.** No Postgres in M1.

The deployment target must therefore provide:
- A Node.js runtime (or container)
- A managed Redis instance (or sidecar)
- HTTPS termination with a public domain
- Environment variable management
- A deployment trigger the team can operate without DevOps overhead

Two candidates were identified: **Railway** and **Fly.io**.

## Decision

**Railway for M1.**

- Git-based deploys: push to `main` → deploy. No CLI required for day-to-day operation.
- Redis is a first-class Railway plugin: one click, connection string injected as `REDIS_URL`.
- `PORT` is injected automatically; the backend already reads it via `process.env.PORT`.
- HTTPS termination and a `*.up.railway.app` subdomain are provided with zero configuration.
- Custom domain via Railway dashboard when needed.
- Cost: $5/month Hobby plan covers the M1 lab test.

The mobile app's `EXPO_PUBLIC_API_BASE_URL` is set to the Railway deployment URL in the app's `.env`.

## Alternatives considered

1. **Fly.io** — better long-term fit: global anycast, 256MB VMs, more control over runtime. The DX is steeper: `flyctl` CLI, `fly.toml`, manual Redis attachment via Upstash or Fly managed Redis. For a 2-device lab test, this overhead is not justified. **Re-evaluate at M2** if global edge compute becomes relevant for proximity matching.
2. **Render** — similar DX to Railway, slightly less polished Redis integration. No clear advantage over Railway for M1.
3. **Heroku** — familiar, but no free tier and higher cost than Railway for equivalent capacity. Rejected.
4. **AWS (EC2 + ElastiCache)** — correct long-term infrastructure, wrong complexity for M1. If the product scales, a migration ADR will be written at that point.
5. **Self-hosted (VPS)** — introduces manual SSL, process supervision, OS updates. Rejected: the spec emphasises minimizing operational overhead at launch.

## Consequences

- All secrets (`DEVICE_JWT_SECRET`, `REDIS_URL`, etc.) are set in the Railway project dashboard, not in `.env` committed to the repo.
- The backend `.env` file in the repo is for local development only. It must remain in `.gitignore`.
- Railway sleeps Hobby-plan services after inactivity. For M1 (controlled lab test with both testers online simultaneously) this is acceptable. If cold starts become an issue, upgrade to the Pro plan or add a keep-alive ping.
- At M2, re-evaluate Fly.io. If mutual reveal and Vibe matching introduce geo-query latency requirements, Railway's single-region model may become a bottleneck.
