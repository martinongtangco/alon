# Writing ADRs — Format and Quality Bar

## Format

```
# ADR NNNN: <decision title>

Status: Proposed | Accepted | Deprecated | Superseded by ADR NNNN
Date: YYYY-MM-DD
Depends on: [ADR NNNN](NNNN-title.md)   ← optional

## Context
What's the problem? What constraints apply? (cite spec sections)

## Decision
What are we doing? (specific enough that an engineer can implement without asking)

## Alternatives considered
What else did we look at? Why did we reject it?

## Consequences
What's the trade-off? What does this make harder?
```

File location: `docs/decisions/NNNN-short-title.md` (zero-padded, sequential).
Status values: `proposed | accepted | deprecated | superseded by ADR NNNN` (number only — never filenames).

## Quality bar for Accepted status

An ADR is not ready to accept until an engineer can implement it without a single blocker or ambiguous decision. Verify:

- **File locations** — every file to create or modify is named explicitly
- **Interface changes** — new signatures written out in full
- **Wiring** — call direction specified (who calls who, when)
- **Platform splits** — `.android.ts` / `.ios.ts` convention stated where applicable
- **Install step** — any new package listed with exact version
- **Ambiguity test** — could a reasonable engineer make two different choices from the Decision section? If yes, add a sentence resolving it
