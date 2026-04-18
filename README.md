# vibr8.me

> *Feel who's near.*

A native mobile app for passive, proximity-based social discovery. Your phone vibrates as compatible people get close — no screens, no chat, no DMs. Just a nudge to look up.

## Status

**Pre-development.** This repository currently contains:
- Product specification ([docs/spec/app-spec.md](docs/spec/app-spec.md))
- Design references (radar mock, visualizer prototype) in [docs/design/](docs/design/)
- Agent role guides for LLM-assisted development in [docs/agents/](docs/agents/)
- Empty scaffold for the React Native app in [app/](app/) and backend in [backend/](backend/)

No code yet. Features are built one at a time, agent-driven, against the spec.

## Getting started (for LLM agents)

1. Read [CLAUDE.md](CLAUDE.md) first
2. Read the role doc that matches your task (architect / engineer / BA / designer)
3. Read the relevant spec section in [docs/spec/app-spec.md](docs/spec/app-spec.md)
4. Ask before building anything the spec doesn't cover

## Getting started (for humans)

Same, minus step 4 — you can just build.

## Core principles

1. No in-app chat
2. Haptics first
3. Passive by default
4. Battery-conscious (target 3–6% / hr background)
5. Privacy non-negotiable
6. "Buzz Me", never "Poke"

See [CLAUDE.md](CLAUDE.md) for the full principles list and how to work here.

## License

TBD
