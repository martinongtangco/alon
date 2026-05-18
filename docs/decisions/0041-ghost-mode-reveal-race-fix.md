# ADR 0041: Ghost Mode Reveal Race Fence

Status: Accepted
Date: 2026-05-18
Milestone: M3 (security — closes privacy gap in ADR 0036)
Depends on: [ADR 0036](0036-m3-server-enforced-ghost-mode.md), [ADR 0029](0029-m2-mutual-reveal-flow.md)

## Context

A security audit identified a race condition in the Ghost Mode implementation (C3):

When a device activates Ghost Mode (`POST /api/ghost { active: true }`), the server:
1. Deletes `token:{proximityToken}` from Redis.
2. Sets `ghost:{deviceId} = 1`.
3. Deletes `device_token:{deviceId}`.

However, **in-flight reveal intents are not invalidated**. A reveal intent is written to Redis as:

```
reveal:{stronger_token}:{weaker_token} = 1   (TTL: 300s)
```

where `stronger` and `weaker` are the two proximity tokens sorted lexicographically.

If a peer device submitted a reveal intent against the ghosted device's token **before** ghost activation, the key persists in Redis for up to 5 minutes after ghost mode is enabled. If the ghosted device's owner then changes their mind and disables ghost mode — or if a second peer submits a matching reveal intent during the window — the mutual match fires even though the user was in Ghost Mode.

This violates the Ghost Mode contract: *"when I'm in Ghost Mode, I'm completely invisible."* A match that formed while the user was ghosted is a privacy violation.

The same race applies to buzz intents: if a buzz was sent just before ghost activation, the backend has already processed it. This cannot be retroactively undone and is accepted — buzz is a point-in-time action. Reveals are different because they create a durable mutual state.

## Decision

### On ghost activation: sweep pending reveal keys

When `POST /api/ghost { active: true }` is called, after the token deletion and before returning the response, scan and delete all Redis keys matching `reveal:*{token}*` where `token` is the device's current proximity token.

The reveal key format is `reveal:{A}:{B}` where A and B are sorted UUIDs. A key involving the ghosted token will contain the token string in either position.

Implementation in `backend/src/routes/app/ghost.ts`, in the activation branch:

```ts
if (active) {
  const currentToken = await redis.get(`device_token:${deviceId}`);

  if (currentToken) {
    // Delete the proximity token so peers can't resolve it
    await redis.del(`token:${currentToken}`);

    // Sweep any pending reveal intents that involve this token.
    // reveal keys are: reveal:{tokenA}:{tokenB} — the ghosted token appears in either position.
    const revealKeys = await redis.keys(`reveal:*${currentToken}*`);
    if (revealKeys.length > 0) {
      await redis.del(...revealKeys);
    }
  }

  await redis.set(`ghost:${deviceId}`, '1');
  await redis.del(`device_token:${deviceId}`);
}
```

**Note on `redis.keys()`:** Using `KEYS` with a wildcard is acceptable here because:
1. Ghost activation is a rare, user-initiated action (not a hot path).
2. The pattern `reveal:*{token}*` is highly specific — a single token can appear in at most ~50 reveal keys at any given time (limited by the number of concurrent nearby peers).
3. This is a single-process Railway deployment. If the backend scales to multiple processes, migrate to `SCAN` with cursor iteration (see Consequences).

### On the reveal endpoint: check ghost flag before writing intent

Add a ghost check at the start of `POST /api/reveal` in `backend/src/routes/app/reveal.ts`, before any Redis write:

```ts
// backend/src/routes/app/reveal.ts
const isGhosted = await redis.get(`ghost:${deviceId}`);
if (isGhosted) {
  return res.status(403).json({ error: 'Ghost mode is active' });
}
```

This prevents a ghosted device from initiating a reveal (e.g., from a client that bypassed the client-side ghost check). It also prevents the edge case where a ghost device sends a reveal before the server processes the ghost activation.

### Consequences for the mutual reveal flow

The reveal flow (ADR 0029) checks:
```
reveal:{B}:{A} exists?  → mutual match
reveal:{A}:{B} absent?  → write reveal:{A}:{B}
```

After this ADR, if `reveal:{B}:{A}` was written before ghost activation and then swept, the key no longer exists. A subsequent `POST /api/reveal` from a non-ghosted peer against the ghosted device will write a new intent key — which will never be matched because the ghosted device can't resolve tokens. The key will expire naturally via its 300s TTL. This is the correct behaviour.

## Files to modify

| File | Change |
|---|---|
| `backend/src/routes/app/ghost.ts` | In activation branch: after `del token:{currentToken}`, run `keys reveal:*{token}*` sweep and delete |
| `backend/src/routes/app/reveal.ts` | At handler start: check `ghost:{deviceId}` and return 403 if set |

## Alternatives considered

**Sweep on deactivation instead of activation** — wrong direction. The user expects ghost mode to take effect immediately on activation. Sweeping on deactivation would clear intents that legitimately formed after the user came out of ghost mode. Rejected.

**TTL-based expiry (do nothing extra)** — reveal keys have a 300s TTL and will expire on their own. However, the race window is 5 full minutes, which is long enough for a second peer to submit a matching intent, especially in a crowded venue. Rejected as insufficient.

**Store reveal intents in Postgres instead of Redis** — would allow joining against ghost status. Adds schema complexity. Redis is the right store for ephemeral proximity intent state. Rejected.

**SCAN instead of KEYS** — correct for production-scale Redis. For M3 with a single-process deployment and low concurrent user count, `KEYS` with a narrow pattern is safe. Add a TODO comment in the code to migrate to SCAN if the deployment scales.

## Consequences

- Ghost Mode activation now performs an additional Redis `KEYS` call. This is acceptable on a low-frequency action.
- If Redis keyspace is very large (thousands of concurrent active reveals), `KEYS` could block. Add `// TODO: migrate to SCAN cursor if reveal key count exceeds ~1000` as a comment in the implementation.
- The reveal endpoint now returns HTTP 403 for ghosted devices. The client-side ghost check in `store.ts` already prevents this path from being reached under normal conditions. The 403 is a server-side safety net.
- This closes the last known Ghost Mode privacy gap. After ADRs 0036 and 0041 are both implemented, Ghost Mode is enforceable at both the token resolution layer and the reveal intent layer.
