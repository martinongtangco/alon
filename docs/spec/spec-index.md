# vibr8.me — Spec Index

Three product surfaces, three specs. Read the one that matches your task.

---

## Specs

| Surface | Audience | File |
|---|---|---|
| **Mobile App** | The consumer-facing React Native app (iOS + Android) | [`app-spec.md`](app-spec.md) |
| **Business Portal** | Self-serve web app for partner businesses | [`business-portal-spec.md`](business-portal-spec.md) |
| **Admin Dashboard** | Internal backend management tool for vibr8.me staff | [`admin-dashboard-spec.md`](admin-dashboard-spec.md) |

---

## How they relate

```
                      vibr8.me Platform
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    Mobile App        Business Portal    Admin Dashboard
    (end users)        (partners)          (staff)
          │                 │                 │
    Proximity,         Promos, Events,    Moderation,
    Buzz, Radar,       Analytics,         Platform Config,
    Visualizer         Billing            Revenue, Logs
          │                 │                 │
          └────────── Shared Backend ──────────┘
                  (same API, different scopes)
```

- The **mobile app** is what end users interact with. It surfaces promos and events created by partners.
- The **Business Portal** is where partners configure their presence — promos, events, profile, billing.
- The **Admin Dashboard** is where the vibr8.me team manages all three surfaces — approving partners, moderating content, monitoring platform health, and configuring live behavior.

---

## Status

| Spec | Status | Notes |
|---|---|---|
| `app-spec.md` | ✓ Initial draft | Core concept + MVP scope defined |
| `business-portal-spec.md` | ✓ Initial draft | Based on v1 prototype — BA to expand with user stories |
| `admin-dashboard-spec.md` | ✓ Initial draft | Based on v1 prototype — BA to expand with user stories |

Detailed user stories and acceptance criteria will be written separately by the Business Analyst agent, referencing these specs.

---

*Last updated: April 2026*
