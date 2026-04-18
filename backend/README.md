# backend/ — vibr8.me server

**Not yet scaffolded.** Framework + hosting will be chosen in an ADR before implementation starts.

## Intentionally minimal surface

Because there is **no in-app chat**, the backend is dramatically smaller than a typical social product. Services:

| Service | Purpose |
|---|---|
| Profiles | User identity, Vibes, mode |
| Vibe matching | Compatibility scoring from shared Vibes |
| Proximity tokens | Rotating anonymized tokens for BLE broadcast |
| Promo CMS | Partner establishment content |
| Event ingestion | Manual-curation interface for MVP |

## What this backend is NOT

- Not a messaging service (no chat, no DMs, no typing indicators, no read receipts)
- Not a media store (no photo messaging — only profile photo asset storage)
- Not a notification fan-out hub for user content
- Not a content moderation pipeline (no user-generated text to moderate)

If you find yourself about to add one of these, stop and check [`../docs/spec/app-spec.md`](../docs/spec/app-spec.md) §Key Features.

## Privacy rules

- Raw GPS coordinates from users are never stored long-term and never returned to other users
- BLE-layer identifiers are rotating anonymized tokens, not user IDs
- Ghost Mode must be honored server-side as well — even if a Ghost user's token is observed, the backend returns no match

## Before you code

1. Read [`../CLAUDE.md`](../CLAUDE.md)
2. Read [`../docs/agents/engineer.md`](../docs/agents/engineer.md)
3. Read [`../docs/architecture/overview.md`](../docs/architecture/overview.md)
4. Confirm the ADR exists for whatever backend framework is being used
