# ADR 0004: Admin Dashboard Frontend Stack

Status: Accepted
Date: 2026-04-25

## Context

The Admin Dashboard is a web application — separate from the React Native mobile app and from the Business Portal — used by Alon ops, moderation, finance, and engineering staff. Per [docs/spec/admin-dashboard-spec.md](../spec/admin-dashboard-spec.md):

- Web app, no native (line 378)
- Desktop-primary; tablet-readable but not mobile-optimized (line 379)
- Dark-mode only (line 369)
- Information-dense — tables, filters, real-time metrics, log streams (Sections 4–10)
- Real-time features (Live Activity, system status bar) over WebSocket or SSE (line 385)
- Internal tool — "function over form, but still legible" (line 368)

The mobile app uses React Native + TypeScript per the spec. The admin dashboard is a separate codebase but shares the project's TypeScript-first convention. We need to choose the framework, build tool, styling approach, and data-fetching pattern.

## Decision

**Framework**: React 18 + TypeScript (strict mode)
**Build tool**: Vite
**Routing**: React Router v6
**Styling**: Tailwind CSS (dark-mode-only configuration) + Radix UI primitives for accessible components (dialogs, dropdowns, tabs)
**Data fetching**: TanStack Query (React Query) for server state; React Context for session/auth state. No global state library — Zustand from [ADR 0001](0001-state-management.md) belongs to the mobile app, not here.
**Tables**: TanStack Table (headless) — every page in the spec is fundamentally table-driven
**Charts**: Recharts — minimal API, sufficient for the bar charts and progress bars in the spec

Repo location: `admin/` at the repo root, alongside `app/` (mobile) and `backend/`.

## Alternatives considered

1. **Next.js (App Router)** — overkill for an internal SPA. SSR/SEO are not requirements; auth is gated behind 2FA, so server-rendered pages just complicate the auth boundary.
2. **Remix** — same objection as Next.js, plus smaller ecosystem.
3. **Vue / Svelte** — would split the team's frontend mental model with no offsetting benefit. The mobile app is React; keeping the admin dashboard in React lets engineers move between codebases.
4. **Material UI / Ant Design** — heavyweight component libraries that fight Tailwind for control of layout and dark-mode theming. Tailwind + Radix gives the same accessibility guarantees with less visual lock-in.
5. **SWR instead of TanStack Query** — equivalent for simple cases, but TanStack Query's mutation/invalidation story is better suited to the moderation actions in the spec (suspend, ban, kill promo) where the UI must reflect server state changes immediately.

## Consequences

- The dashboard will not share components with the React Native mobile app. This is fine: React Native primitives (`View`, `Text`) don't translate to web, and the visual contexts are different (dark-mode dense desktop vs. ambient mobile).
- Vite gives sub-second HMR, which matters for dense table-driven UI development.
- Tailwind's JIT keeps the bundle small even without aggressive code-splitting. We expect <200 KB initial JS for the shell.
- Radix primitives are unstyled — every dropdown, dialog, and tab needs Tailwind classes. That's a deliberate trade for accessibility-by-default + design control.
- TanStack Query handles request deduplication, caching, and revalidation for the polling-style views (Users table, Businesses table). Real-time views use SSE per [ADR 0007](0007-admin-realtime-transport.md), not Query.

## Implementation notes

- Pin Node.js engines: `>=20.10`. Vite 5 requires Node 18+, but we standardize on 20 LTS.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
- Tailwind config: dark mode `class`, but the `<html>` element always has `dark` applied — there is no light-mode toggle. Authoring consistency, not user choice.
- Path alias: `@/` → `admin/src/`.
- No CSS-in-JS libraries. No emotion, no styled-components. Tailwind only.
