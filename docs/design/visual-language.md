# Visual Language

The canonical source for visual decisions. Pair with the live reference files:
- [`radar-reference.html`](radar-reference.html) — midcentury radar screen (light register)
- [`visualizer-reference.html`](visualizer-reference.html) — dark reactive canvas with 5 modes

If this doc and the references ever disagree, the references are source of truth until this doc is updated.

---

## Two registers

The app uses two deliberately different visual registers. They share the palette and the typographic voice, but one is calm and one is kinetic.

| Register | Where | Feel | Background |
|---|---|---|---|
| Midcentury radar | Radar, Matches, Feed, Profile, Onboarding | Calm, warm, daylit, passive | Cream (`#f5f0e8`) / stone (`#ede8dc`) |
| Visualizer | Full-screen when activated | Kinetic, rich, reactive | Warm-black (`#1a1208`) |

Do not mix registers. The Radar screen is not dark. The Visualizer is not cream.

---

## Color tokens

```
/* Primary brand */
--teal-600:      #4a8e82   /* primary accent, user, active */
--teal-100:      #d4eae7   /* teal chip / surface */
--teal-900:      #2d5f58   /* teal text on light surface */

/* Warm accents */
--amber-600:     #c49a3c   /* promos, warm accent */
--amber-100:     #f2e8d4   /* promo chip / surface */
--amber-900:     #8a6020   /* amber text */

--rust-600:      #b85c38   /* events, strong-signal, alerts */
--rust-100:      #f0ddd5   /* rust chip / surface */
--rust-900:      #7a3520   /* rust text */

/* Secondaries */
--brown-600:     #8b6047
--brown-100:     #e8ddd2
--brown-900:     #5c3d26

--olive-600:     #7a8c52
--olive-100:     #e2e8d4
--olive-900:     #4e5c2e

/* Neutrals */
--bg-warm:       #f5f0e8   /* primary light bg */
--bg-warm-alt:   #ede8dc   /* map surface */
--bg-block:      #e4ddd0   /* city blocks */
--bg-road:       #f0ebe0
--border-warm:   #d4c9b5
--text-primary:  #3d2e1e
--text-muted:    #8a7a68
--text-dim:      #9a8a78

/* Dark / visualizer */
--bg-dark:       #1a1208
--bg-dark-deep:  #0f0a04

/* Extended palette (visualizer particles) */
--p-gold:        #c49a3c
--p-brown:       #8b6047
--p-teal:        #4a8e82
--p-rust:        #b85c38
--p-olive:       #7a8c52
--p-amber-hi:    #d4a853
--p-teal-deep:   #5c8a7a
--p-orange:      #c47840
--p-siena:       #a0522d
--p-sage:        #6b8e6b
--p-peru:        #cd853f
--p-jade:        #4a7a6a
```

**Do not introduce new colors** outside this set without a design review. The palette is deliberately constrained to keep the product recognizable.

---

## Typography

| Role | Family | Weight | Size | Letter-spacing |
|---|---|---|---|---|
| Wordmark ("vibr8.me") | Georgia / serif | regular, italic | 13–16px | 0.12em |
| UI labels (uppercase) | -apple-system / sans | 600 | 9–11px | 0.08–0.14em |
| UI body | -apple-system / sans | 400–500 | 11–13px | normal |
| Stat numbers | -apple-system / sans | 700 | 16–18px | normal |
| Tooltip name | -apple-system / sans | 600 | 11px | normal |
| Tooltip sub | -apple-system / sans | 400 | 10px | normal |

Casing: **lowercase for UI hints** ("move to vibe", "wave it around"). Title Case or brand-cased for labeled actions ("Buzz Me", "Ghost Mode"). Never ALL CAPS except on micro-labels with generous letter-spacing.

---

## Motion

### Ambient (always-on)
- Radar sweep: linear, 4s/revolution, low-alpha conic gradient
- User pulse rings: 2s ease-out, two staggered (0s + 0.5s delay), scale 0.8 → 2.0, opacity 1 → 0
- Nearest-person halo: soft ping, 2.5s cycle
- Vibe signal bars: opacity 0.35 → 1, 1.2s ease-in-out, staggered delays per bar

### Reactive (visualizer)
- All motion driven by accelerometer in real time
- Modes auto-cycle every ~6 seconds; tap to skip
- Mode transitions: crossfade only, no bounce

### Transitions
- Screen / modal: 300–400ms ease-out
- Tooltip show/hide: 200ms
- Mode change: 300–600ms crossfade
- Never use spring overshoot. Never use bounce.

### Reduced motion (required)
When the OS motion-reduce flag is on:
- Radar sweep → static (no rotation)
- Pulse rings → single static outer ring, no animation
- Visualizer → freeze on current frame, or static palette gradient
- Bars → static at mid-opacity

---

## Iconography

- Emoji is acceptable only on map pins and small inline accents: ☕ 🍻 ⚡
- No emoji in body copy, buttons, or headings
- People dots use initials (2 letters), not icons
- No custom illustrated mascots, characters, or scene art

---

## Spacing

Use a 4pt grid. Common tokens:

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
```

- Phone-frame inner padding: 12–18px
- Card padding: 8–10px
- Inter-section gap: 10–12px
- Button padding: 10px × 22px

---

## Accessibility

- Contrast: body text ≥ 4.5:1, large text / UI ≥ 3:1 on its background
- Touch targets: ≥ 44×44 pt iOS, 48×48 dp Android
- Every interactive dot has an accessible label: "`{Name}`, `{distance}` away, `{category}`"
- Visual fallback for haptic signals (the Vibe Signal meter) always visible — never "haptic-only"
- Focus states are visible and high-contrast

---

## Don'ts

- No gradients as primary surfaces (subtle alpha gradients at panel edges are fine — see `viz-hud`)
- No drop shadows except at a single standardized elevation for modals / tooltips
- No neon, no fluorescent, no saturated primary colors
- No hearts ❤️, flames 🔥, swipe-card tropes
- No illustrated mascots
- No exclamation points in copy
- No photos on the radar — photos appear only after mutual reveal

---

## Sources of truth

| Question | Look here |
|---|---|
| Exact hex for color X | this file, Color tokens |
| How does the radar sweep animate | `radar-reference.html`, `.radar-sweep` |
| How does the visualizer react to motion | `visualizer-reference.html`, `loop()` + `draw*()` |
| What does the Vibe Signal meter look like | `radar-reference.html`, `.vibr-indicator` |
| Tooltip layout | `radar-reference.html`, `.tooltip` |
| Copy for a specific UI string | `docs/agents/designer.md`, Copy bank (or expand it) |
