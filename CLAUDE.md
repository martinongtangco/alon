# vibr8.me — Claude Code Foundation

This file is the top-level context any Claude Code (or other LLM) agent loads before touching this repo. Read this first. Then open the role doc that matches the work you've been asked to do.

---

## What this project is

**vibr8.me** is a native mobile app for passive, proximity-based social discovery. The phone vibrates in escalating patterns as compatible users get physically close — a "social radar built into your pocket." No in-app chat. Ever.

Tagline: *Feel who's near.*

Authoritative product spec: [docs/spec/app-spec.md](docs/spec/app-spec.md) — always the source of truth when code and spec disagree, raise it rather than guessing.

---

## Core product principles (do not violate without explicit approval)

1. **No in-app chat.** The app's job ends when two people are physically near each other. Not a missing feature — a design principle.
2. **Haptics first.** Vibration is the primary output channel. The UI supports the haptic, not the other way around.
3. **Passive by default.** The app is meant to run invisibly. Users shouldn't need to stare at it.
4. **Battery is a first-class feature.** Target 3–6% / hr background drain. Never use continuous high-accuracy GPS. BLE is the primary proximity tool. See the Battery Efficiency Strategy section of the spec.
5. **Privacy is non-negotiable.** No exact location ever shared with other users. Reveals are mutual and opt-in. Ghost Mode is a full stop.
6. **Buzz Me, not Poke.** "Poke" is Facebook IP. The native term is **Buzz Me** throughout product, code, and copy.

If a feature request conflicts with any of these, flag it before building.

---

## Tech stack

- **Mobile**: React Native (iOS + Android), TypeScript
- **Proximity**: `react-native-ble-plx` (BLE primary — [ADR 0002](docs/decisions/0002-ble-library.md)), low-power GPS + geofencing (secondary, M2)
- **Haptics**: `expo-haptics` (cross-platform wrapper over `CoreHaptics` / `VibrationEffect`)
- **State**: Zustand ([ADR 0001](docs/decisions/0001-state-management.md))
- **Backend**: Node/Express + Redis ([ADR 0003](docs/decisions/0003-backend-framework.md), [ADR 0014](docs/decisions/0014-redis-first-token-store.md))
- **Deployment**: Railway ([ADR 0017](docs/decisions/0017-deployment-platform.md))

All architectural decisions are recorded in `docs/decisions/`. **An accepted ADR is a build instruction — implementing code that follows an accepted ADR does not require a new ADR.** Only write a new ADR when making a new architectural decision not already covered.

---

## Repository layout

```
vibr8me/
├── CLAUDE.md                      ← you are here
├── README.md                      project readme for humans
├── docs/
│   ├── spec/app-spec.md           authoritative product spec
│   ├── agents/                    role-specific guidance (read the one that matches your task)
│   │   ├── architect.md
│   │   ├── engineer.md
│   │   ├── business-analyst.md
│   │   └── designer.md
│   ├── design/                    visual references + system
│   │   ├── visual-language.md
│   │   ├── radar-reference.html   midcentury radar mock (source of truth for radar)
│   │   └── visualizer-reference.html working visualizer prototype (5 modes)
│   ├── architecture/
│   │   └── overview.md            high-level system architecture
│   └── decisions/                 ADRs — one file per architectural decision
├── app/                           React Native app (to be scaffolded)
│   ├── src/
│   │   ├── components/            shared UI components
│   │   ├── screens/
│   │   │   ├── Radar/             primary screen — proximity radar map
│   │   │   ├── Matches/           mutual reveals
│   │   │   ├── Feed/              promos + activities
│   │   │   ├── Profile/           vibes, mode, ghost toggle
│   │   │   ├── Visualizer/        full-screen accelerometer art
│   │   │   └── Onboarding/        signup + vibe setup
│   │   ├── navigation/
│   │   ├── services/
│   │   │   ├── ble/               BLE scanning + advertising
│   │   │   ├── location/          low-power GPS, geofencing
│   │   │   ├── haptics/           vibration patterns
│   │   │   ├── proximity/         distance + compatibility scoring
│   │   │   └── api/               backend client
│   │   ├── state/                 store / context
│   │   ├── hooks/
│   │   ├── theme/                 colors, spacing, typography
│   │   ├── utils/
│   │   ├── types/
│   │   └── constants/
│   └── assets/
└── backend/                       server-side (to be scaffolded)
```

---

## How to work here

### Role-based entry points

Pick the doc that matches what you've been asked to do. Read CLAUDE.md + one role doc + the spec — that is the full context you need.

| If you are doing... | Read |
|---|---|
| System design, tech choices, integration patterns, ADRs | [docs/agents/architect.md](docs/agents/architect.md) |
| Writing code, building features, fixing bugs | [docs/agents/engineer.md](docs/agents/engineer.md) |
| Requirements, user stories, acceptance criteria, scoping | [docs/agents/business-analyst.md](docs/agents/business-analyst.md) |
| Visual design, UI components, motion, copy | [docs/agents/designer.md](docs/agents/designer.md) |

### Global conventions (all agents)

- **Don't over-build.** The spec is lean on purpose. Don't add features, settings, or abstractions the spec doesn't call for.
- **Preserve the voice.** Warm, confident, slightly edgy. Not corporate. Never "Hey friend!" or emoji-heavy.
- **Every change links back to the spec.** A PR or code change should be traceable to a spec section. If it isn't, justify it.
- **Decisions get written down.** Any non-obvious architectural choice goes in `docs/decisions/NNNN-title.md` (ADR format).
- **Default to no comments in code.** Let names do the work. Comments only for non-obvious *why*.
- **Secrets never commit.** `.env` is gitignored. API keys go in a secrets manager, not in code.

### What "done" means

A feature is done when:
1. It satisfies the spec section it maps to
2. It respects the six core principles above
3. It works on both iOS and Android (unless a platform-specific exception is documented)
4. It has been tested end-to-end on a real device (haptics and BLE cannot be validated in a simulator)
5. Battery impact has been measured if the feature runs in the background

---

## Open questions

Tracked at the bottom of [docs/spec/app-spec.md](docs/spec/app-spec.md) — do not invent answers to these. Flag them to the product owner.
