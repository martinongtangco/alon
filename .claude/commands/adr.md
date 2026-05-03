---
name: adr
description: Create a new Architecture Decision Record for vibr8.me. Scaffolds the file, auto-numbers it, and updates the index. Use when recording an architectural decision, technology choice, or resolving an open question from docs/agents/architect.md.
---

## Process

1. List `docs/decisions/` to find all `[0-9][0-9][0-9][0-9]-*.md` files. The next number is the highest found + 1, zero-padded to 4 digits.

2. If the user didn't pass a title, ask: "What decision are we recording?" Do NOT proceed without a title.

3. Derive the filename slug: lowercase, spaces to hyphens, drop articles. "BLE Library Selection" → `ble-library-selection`.

4. Create `docs/decisions/NNNN-<slug>.md` using this exact template — fill in number, title, and today's date; leave body sections as-is:

```markdown
# ADR NNNN: <Title>

Status: Proposed
Date: YYYY-MM-DD

## Context

<!-- What problem are we solving? What constraints apply? Cite spec sections by name. -->

## Decision

<!-- What are we doing? Be specific — a reader who wasn't in the room must understand the choice. -->

## Alternatives considered

<!-- One paragraph per alternative. End each with: "Rejected because ___." -->

## Consequences

<!-- What trade-off does this introduce? What becomes harder? What does this unlock? -->
```

5. Add a row to the `## Index` table in `docs/decisions/README.md`:
   ```
   | [NNNN](NNNN-<slug>.md) | <Title> | Proposed |
   ```

6. Report the new file path. If the decision touches any open question listed in `docs/agents/architect.md`, name it.

Do NOT fill in the body sections. The architect writes those.
