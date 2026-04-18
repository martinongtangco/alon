# Architecture Decision Records

One file per architectural decision. Owned by the architect; read by everyone.

## Format

```
# ADR NNNN: <decision title>
Status: Proposed | Accepted | Superseded by ADR-XXXX
Date: YYYY-MM-DD

## Context
What's the problem? What constraints apply? Cite spec sections.

## Decision
What are we doing?

## Alternatives considered
What else did we look at? Why did we reject it?

## Consequences
What's the trade-off? What does this make harder?
```

## Naming

`NNNN-short-title.md` — NNNN is a zero-padded sequence number (0001, 0002, ...).

## Index

_No ADRs yet. The architect will add entries as decisions are made._

| ADR | Title | Status |
|---|---|---|
| — | — | — |

## Open decisions awaiting an ADR

From `docs/agents/architect.md`:

- State management library
- BLE library (React Native)
- Backend framework + hosting
- Matching engine topology
- Proximity token rotation cadence
- Offline radar behavior
- Event ingestion pipeline
- Age verification strategy
- Android OEM background-restriction handling (Samsung / Xiaomi)
