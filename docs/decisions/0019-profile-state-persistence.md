# ADR 0019: Profile and State Persistence

Status: Accepted
Date: 2026-05-10
Accepted: 2026-05-10

## Context

The Zustand store initialises with `onboarded: false` and a default profile on every cold start. There is no persistence layer — closing and reopening the app re-runs onboarding and resets all user preferences. This makes real-device testing impossible (re-onboarding on every restart) and is a regression from the M1 success criterion.

State falls into two categories:

- **Durable** — set once by the user and should survive restarts: `onboarded`, `profile` (name, initials, bio, vibes, mode, ghostMode)
- **Ephemeral** — derived at runtime from BLE scans or network fetches and should always start empty: `nearby`, `signalLevel`, `promos`, `events`, `matches`, `feed`

`@react-native-async-storage/async-storage` is already installed (used in `bootstrap.ts` and `token.ts`). Zustand ships `persist` middleware and a `createJSONStorage` adapter in its standard package — no new dependencies required.

## Decision

Wrap the Zustand store with `persist` middleware, persisting only the durable slice to AsyncStorage.

### File to modify

`app/src/state/store.ts` — the only file that changes.

### Implementation

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // ... existing store definition unchanged ...
    }),
    {
      name: 'vibr8-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        onboarded: state.onboarded,
        profile: state.profile,
      }),
    },
  ),
);
```

`partialize` whitelists exactly what is written to storage. Everything not listed (`nearby`, `signalLevel`, `promos`, `events`, `matches`, `feed`) is omitted — it always starts as the initialiser default.

### Storage key

`vibr8-app-state` — plain string, no namespacing needed for M1. If multiple stores are added in M2, prefix with the store name.

### No migration needed for M1

There is no existing persisted data to migrate. The first write after this change creates the key fresh.

## Alternatives considered

**`react-native-mmkv`** — synchronous, faster than AsyncStorage, popular in RN performance-sensitive apps. Rejected for M1: requires a native build step and adds a dependency. AsyncStorage is already installed and sufficient for the ~500 byte profile payload written once on onboarding completion.

**Manual AsyncStorage reads/writes in each action** — explicit control over what is saved and when. Rejected: more code, more failure modes, and duplicates what `persist` middleware provides for free.

**Persisting the full store** — simplest option. Rejected: ephemeral state (`nearby`, `matches`, etc.) becomes stale on restart. A user reopening the app 2 hours later would see last session's nearby people on the radar until the next BLE scan — incorrect and confusing.

## Consequences

- Onboarding runs exactly once. After `completeOnboarding()`, `onboarded: true` is written to AsyncStorage and survives all subsequent restarts.
- Profile changes (mode switch, vibe toggle, ghost mode) are written to AsyncStorage automatically on every store update via `partialize`. No explicit save calls needed anywhere.
- `nearby`, `signalLevel`, and all feed/match state always start empty — callers must not assume they are populated before `hydrate()` and `bleService.start()` run.
- The `persist` middleware makes `useAppStore` initialisation asynchronous on first render (it must read AsyncStorage before hydrating). Zustand handles this via its `onRehydrateStorage` hook — the store starts with defaults and updates once storage is read. This is imperceptible on modern devices (~10ms read time for a small key).
