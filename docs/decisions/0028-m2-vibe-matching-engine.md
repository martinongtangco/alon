# ADR 0026: M2 — Vibe Matching Engine (Inline Jaccard Scoring)

Status: Accepted
Date: 2026-05-14
Milestone: M2
Depends on: [ADR 0010](0010-app-schema-data-model.md), [ADR 0012](0012-milestone-1-product-scope.md)

## Context

ADR 0012 explicitly deferred the matching engine to M2 with a feature flag. Vibe data is collected during onboarding and stored in `app.users.vibes` (ADR 0010) but is not used for matching in M1 — all proximity detection is token-based, and the radar shows anonymous blobs without compatibility scoring.

In M2, the spec requires:
> *Vibration intensity is influenced by compatibility score (shared Vibes = stronger buzz)*

The matching question is: **where and how often does compatibility scoring run?**

Three topologies were considered:

1. **Inline** — score is computed at query time inside the existing Express backend when the app calls `/api/matches` or a new `/api/nearby` endpoint. No new service or infrastructure.
2. **Background worker** — a separate process (WorkManager / cron) pre-computes match scores for all active device pairs and stores results in Redis. Query time is a simple cache read.
3. **External ML service** — a dedicated recommendation service (e.g. a Python FastAPI pod) with a richer model (embeddings, collaborative filtering). Results written to Postgres.

## Decision

**M2 uses inline Jaccard similarity scoring, computed at query time in the Express backend.**

### Algorithm

Jaccard similarity on the `vibes` arrays:

```
score = |A ∩ B| / |A ∪ B|    → float in [0, 1]
```

A score of `1.0` means identical vibe sets. A score of `0.0` means no overlap. The score maps to the `NearbyPerson.compatibility` field already present in the app type system (float 0–1), which drives dot size and the haptic strength multiplier in M2.

### Where it runs

A new endpoint `GET /api/nearby` accepts the caller's current vibe set (from the device JWT's persisted profile) and a list of proximity tokens currently visible in BLE scan results. The backend:

1. Looks up each token in Redis (`token:{uuid}` → `deviceId`).
2. Queries `app.users` for the `vibes` column of each resolved deviceId in a single `WHERE id = ANY($1)` query.
3. Computes Jaccard score for each peer against the requesting device's stored vibes.
4. Returns the ranked list with scores.

The requesting device's vibes are read from `app.users` using the authenticated deviceId — not sent in the request body. This prevents client-side spoofing of vibe data to inflate compatibility.

### New endpoint contract

```
GET /api/nearby
Auth: device JWT
Request body: { tokens: string[] }   // proximity tokens from current BLE scan
Response: Array<{
  token: string,
  compatibility: number,             // Jaccard score 0–1
  distanceBand: 'very-near' | 'near' | 'far'
}>
```

The app calls this endpoint whenever the BLE peer list changes (debounced, max once per 10 seconds). The response is merged into the Zustand `nearby` array — existing position (bearing, distance) is preserved; only `compatibility` is updated from the server.

### Feature flag

The `/api/nearby` endpoint and the `compatibility`-driven haptic multiplier are both gated behind a `FEATURE_VIBE_MATCHING=true` environment variable. In M1 production the flag is absent (or false), and the endpoint returns a stub with `compatibility: 0.5` for all tokens. The haptic loop already uses `compatibility` indirectly through dot size; in M1 all peers are treated equally.

### Why not background pre-computation?

At M2 scale (controlled beta, tens of concurrent users per area) the Jaccard computation is O(|vibes_A| + |vibes_B|) — negligible. Pre-computing requires tracking which device pairs are currently in proximity, invalidating scores on token rotation, and adding a worker process to the deployment. The complexity is not justified until matching runs at city scale (M3+).

### Why not an ML service?

Vibe arrays are 1–8 items from a fixed 20-item vocabulary. There is no semantic distance between items (e.g. "music" and "concerts" are different choices, not similar). A learned embedding model would overfit this sparse, low-cardinality data and would require a training pipeline before the first user is onboarded. Rejected for M2; revisit at M3 if Vibe taxonomy expands.

## Consequences

- A new route file `backend/src/routes/app/nearby.ts` is added. It is registered in `backend/src/routes/app/index.ts` under `GET /nearby`.
- The `authDevice` middleware applies — unauthenticated calls are rejected.
- Redis and Postgres are both in the hot path for this endpoint. A missing Redis key (token not found — expired or unknown) returns `compatibility: 0` for that token. A Postgres failure falls back to `compatibility: 0.5` for all peers (safe default).
- Token rotation (every 15 minutes) means up to 15 minutes of stale token → user mappings. The app already handles the period when a rotated token hasn't propagated: the old entry ages out of BLE scan results and the new token appears. During the brief transition window, `compatibility` is `0` (unknown token). This is acceptable — the user feels a slightly weaker buzz for a few seconds until the new token resolves.
- Vibe matching is M2 only. The `compatibility` field exists in the M1 type system as a forward-compatibility measure (ADR 0010) but is always `0.5` in M1 production.
