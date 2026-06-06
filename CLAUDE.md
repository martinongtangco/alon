# Alon — Agent Root

**What:** Native mobile app for passive, proximity-based social discovery. The phone vibrates as compatible users get physically close. No in-app chat. Ever.

**Tagline:** *Feel who's near.*

---

## Core principles — never violate

1. **No in-app chat.** The app's job ends when two people are physically near each other.
2. **Haptics first.** Vibration is the primary output. The UI supports the haptic.
3. **Passive by default.** Runs invisibly. Users shouldn't need to stare at it.
4. **Battery is a first-class feature.** Target 3–6% / hr background drain. BLE primary, never continuous high-accuracy GPS.
5. **Privacy is non-negotiable.** No exact location shared between users. Reveals are mutual and opt-in. Ghost Mode = full stop.
6. **Buzz Me, not Poke.** Throughout product, code, and copy.

---

## Tech stack

| Layer | Choice |
|---|---|
| Mobile | React Native + TypeScript |
| Proximity | `react-native-ble-plx` (BLE primary), low-power GPS geofencing (M2) |
| Haptics | `expo-haptics` |
| State | Zustand + AsyncStorage |
| Backend | Node/Express + Redis + PostgreSQL |
| Deployment | Railway |

All architectural decisions: `docs/decisions/` (34 ADRs, all Accepted). An accepted ADR is a build instruction — no new ADR needed to implement it. Packages named in an ADR are pre-authorized; install them.

---

## Repo layout

```
docs/spec/        product spec + agent constraints
docs/agents/      role docs
docs/decisions/   ADRs 0001–0034
docs/design/      visual references + system
app/src/          React Native app
backend/src/      Node/Express backend
```

---

## Load order

1. **This file**
2. **`docs/spec/constraints.md`** — hard rules + current milestone in ~60 lines
3. **Your role doc** (table below)
4. Pull further files only as the task requires

Do not load the full spec unless doing product or design work. Do not read all ADRs — look up specific ones by number when relevant.

---

## Role routing

| Task | Read |
|---|---|
| Architecture, tech choices, ADRs | `docs/agents/architect.md` |
| Feature code, bug fixes, tests | `docs/agents/engineer.md` |
| Requirements, user stories, scope | `docs/agents/business-analyst.md` |
| Visual design, UI, copy, motion | `docs/agents/designer.md` |

---

## Global conventions

- No code comments unless the *why* is non-obvious. Names do the work.
- Secrets never commit. `.env` is gitignored.
- Every change traces to a spec section or ADR. If it doesn't, justify it.
- Platform-specific code: `.ios.ts` / `.android.ts` suffixes — no `Platform.OS` checks in business logic.
- Packages named in an accepted ADR are pre-authorized. Install them without asking.
- If a feature request conflicts with the six principles above, flag it before building.

---

## Agent skills

### Issue tracker

Issues tracked as GitHub issues in martinongtangco/alon. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo. No `CONTEXT.md` yet. ADRs live in `docs/decisions/`. See `docs/agents/domain.md`.
