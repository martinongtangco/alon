# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`docs/decisions/README.md`** — the ADR index for this project. All ADRs follow the path `docs/decisions/NNNN-short-title.md`.
- Read ADRs that touch the area you're about to work in.

This project does not use `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/`. Do not look for or create those paths.

## File structure

```
/
├── CLAUDE.md
├── docs/
│   ├── spec/app-spec.md               ← product requirements (source of truth)
│   ├── decisions/                     ← all ADRs
│   │   ├── README.md                  ← ADR index (start here)
│   │   ├── 0001-state-management.md
│   │   └── NNNN-short-title.md
│   └── agents/                        ← role docs (architect, engineer, etc.)
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
