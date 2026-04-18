# vibr8.me — App Specification

## Overview

**vibr8.me** is a native mobile app redefining social discovery through passive, proximity-based interaction. Unlike traditional social media that demands constant attention, vibr8.me runs silently in the background — your phone vibrates at different intensities as other users get closer, nudging you to look up and connect in real life. No awkward cold approaches. No staring at your screen. Just a subtle buzz that says *someone interesting is nearby.*

Think Pokémon GO, but the goal is real human connection — not a screen.

---

## Core Concept

> **Set it. Forget it. Feel it.**

Users set up a profile once, define their interests and what they're open to (networking, friendships, dating, local deals), and let the app run passively. The phone vibrates in escalating patterns based on proximity and compatibility with nearby users — like a social radar built into your pocket.

---

## UI / UX Design

### Radar Map Screen (Primary View)

The main screen is a **dark-mode radar map** — a live, GTA-style proximity display centered on the user. It's not for navigation; it's a social awareness layer on top of a simplified city grid.

**Visual language:**

| Element | Shape | Color | Meaning |
|---|---|---|---|
| You | Pulsing green dot with expanding rings | Green (`#64dca0`) | Your position at center |
| People | Avatar circle with initials | Blue (close), Purple / Pink / Teal (others) | Nearby compatible users |
| Promos | Rounded square with icon | Yellow (`#ef9f27`) | Establishment deals |
| Events / Activities | Rounded square with icon | Red (`#e24b4a`) | Things happening nearby |

**Radar mechanics:**
- Three concentric rings radiate from center, labeled `50m / 100m / 250m`
- A slow green sweep animation rotates continuously (passive, ambient feel)
- Dot size and glow intensity scale with compatibility score and proximity
- Tapping a dot surfaces an anonymous **Vibe Card** popup: name/initials, shared interests, distance badge
- Tapping the map background dismisses all cards

**HUD overlay (bottom panel):**
- Stat pills: `People nearby`, `Promos active`, `Events`
- Mode badge (e.g. "Networking", "Chill", "Explorer") — tappable to switch
- Minimal dot legend: People · Promos · Events · You
- No clutter — the map breathes

**Vibe Signal Meter (top-right corner):**
- 5-bar animated indicator showing current vibration intensity
- Green bars = low signal (far), amber = medium, red = strong (someone right next to you)
- Mirrors the phone's actual haptic output visually for at-a-glance awareness

**Design principles:**
- Dark map base (`#0d0d1a`) with muted city block grid — legible without being distracting
- All UI chrome uses dark overlays with subtle borders — feels like a HUD, not a traditional map app
- Motion is ambient and non-intrusive: sweep rotates, dots pulse gently, nothing screams for attention
- The screen is glanceable — you open it for 3 seconds, understand the scene, put it away

### Bottom Navigation

Four tabs:
1. **Radar** (map, active tab) — the core screen
2. **Matches** (heart icon) — mutual reveals and pending connections
3. **Feed** (list icon) — promos and events feed
4. **Profile** (circle icon) — Vibes, mode settings, ghost toggle

---

## Key Features

### 1. Proximity Vibration Engine
- Phone vibrates in **graduated patterns** based on distance to compatible users
  - **Faint pulse** — Someone compatible is within ~500m
  - **Steady rhythm** — Within ~100m
  - **Strong buzz** — Within ~20m (right next to you)
- Users can choose vibration styles: subtle, playful, distinct patterns per match type
- Fully passive — no need to open the app

### 2. Interest-Based Matching ("Vibes")
- Users define their **Vibes** on setup: e.g., tech, music, fitness, food, startups, art, travel
- Vibration intensity is influenced by **compatibility score** (shared Vibes = stronger buzz)
- Optional: set your mode — *Networking*, *Chill*, *Dating*, *Explorer*

### 3. Proximity Reveal & Icebreakers
- When two users are close, the app surfaces a minimal **anonymous card** — just their Vibes and a single conversation starter question (no names, no photos yet)
- Users can **tap to reveal** more info if mutually interested
- Designed to spark natural, low-pressure in-person conversations
- **No in-app chat. Ever.** The app's job ends when two people are near each other — the real world takes over from there. This is a core product principle, not a missing feature.

### 4. Buzz Me
- A lightweight, one-tap signal a user can send to someone nearby on the radar — their phone physically vibrates with a distinct "buzz" pattern so they know someone wants to connect
- **No message, no text, no emoji** — just a buzz. The intention is communicated through the haptic alone
- Recipient sees the sender's Vibe card and can **buzz back** to signal mutual interest, or ignore
- Proximity-gated: you can only buzz someone within ~100m — forces real-world closeness before digital acknowledgment
- Distinct vibration pattern differentiates a Buzz Me from the passive proximity buzz so users always know what they're feeling
- Rate-limited to prevent spam (max 3 buzzes per person per day)

> **On naming:** "Poke" is strongly associated with Facebook's registered feature. "Buzz Me" is used throughout as the vibr8.me-native term — it's on-brand with the haptics-first identity and avoids any IP conflict.

### 5. The Visualizer
A full-screen generative art display — the app's "say hi" mode and concert/party feature. Activated by shaking or waving the phone, or by long-pressing the Buzz Me button.

**How it works:**
- The phone's accelerometer drives the visuals in real time — the harder/faster you move the device, the more intense the display
- Five rotating visual modes, each with a distinct personality:
  - **Pulse** — morphing organic rings and drifting particles that stretch toward motion
  - **Lava** — slow blob forms that connect with tendrils, reactive to tilt
  - **Constellation** — parallax star field with constellation lines that shift with the phone angle
  - **Fracture** — lightning crack bursts that explode more intensely with fast movement
  - **Aurora** — layered wave bands that ripple and distort with motion
- Modes auto-cycle every ~6 seconds, or tap to skip to the next
- Color palette matches the vibr8.me earth tone identity: amber, teal, rust, brown, olive

**Use cases:**
- **Buzz greeting** — when you Buzz Me someone nearby, both phones can open the Visualizer as a mutual "hey, that's me" signal. No words needed
- **Concert & party mode** — hold it up in a crowd. The accelerometer reacts to your body moving with the music. It becomes ambient art
- **Identity signal** — your phone is doing something visually distinct. It's a conversation starter without saying anything

**Design principles:**
- Dark canvas (`#1a1208`) so it pops in any lighting, including direct sunlight and dark venues
- No UI chrome while active — pure full-screen visual. The vibr8.me wordmark appears subtly at the bottom
- Tap anywhere to cycle modes; shake to intensify
- Battery-conscious: Visualizer is an active foreground feature only — it never runs in the background

### 6. Local Promos & Establishment Deals
- Partner establishments (cafes, gyms, bars, co-working spaces) can push **proximity-triggered offers**
  - "You're 50m away — show this for 20% off"
- Offers appear as a gentle notification, never intrusive
- Encourages users to explore nearby spots they might not have entered otherwise

### 7. Nearby Activities Feed
- Curated **local events and activities** surfaced based on user location and Vibes
- Community-submitted and verified: workshops, pop-ups, meetups, open mics
- Lightweight — not a full events platform, just a discovery nudge

### 8. Privacy-First Design
- **No exact location is ever shared** with other users — only approximate proximity zones
- Users can go **"Ghost Mode"** anytime (invisible, but can still see promos)
- Profile reveals are always **mutual and opt-in**
- Data minimization: the app collects only what's needed for proximity and matching

---

## User Flow

```
1. Download & Sign Up
   └── Set profile: name, photo (optional), bio, Vibes, current mode

2. App runs in background
   └── BLE / GPS detects nearby vibr8 users

3. Phone vibrates
   └── Intensity = distance + compatibility

4. User feels the buzz
   └── Glances at app → sees anonymous Vibe card on radar

5. Optional: Buzz Me
   └── Tap to send a haptic signal → their phone buzzes → they buzz back

6. Mutual interest → Reveal
   └── Names, photos shown — now go talk to them in person

7. Go explore
   └── Nearby promos + activities surfaced along the way

   ✕ No chat. No DMs. No messages. Go outside.
```

---

## Technical Requirements

### Platform
- **React Native** (iOS + Android)
- Background location + BLE (Bluetooth Low Energy) for proximity detection

### Core Technologies
- **BLE / Ultra-Wideband (UWB)** for short-range proximity (where hardware allows)
- **GPS** for medium/long-range awareness and local feed
- **Push Notifications** for promo triggers
- **Haptics API** for vibration patterns (iOS `CoreHaptics`, Android `VibrationEffect`)

### Backend
- User profiles + Vibe matching engine
- Proximity zone broadcast (anonymized, server-side)
- Establishment partner CMS for promo management
- Activity/event ingestion pipeline

### Privacy & Security
- End-to-end encrypted messaging (post-reveal)
- No raw GPS coordinates shared between users
- Anonymized proximity tokens, not user IDs, used for broadcast

---

## Monetization

| Stream | Model |
|---|---|
| **Establishment Partnerships** | Monthly fee for promo broadcast access |
| **vibr8 Pro** | Subscription — custom vibration patterns, extended Vibe slots, activity boosts |
| **Event Promotions** | Pay-to-feature local events in the activity feed |
| **Brand Activations** | Geo-fenced campaigns for brands at events/venues |

---

## Target Audience

- **Primary**: Young professionals (22–35) in urban areas — open to networking, social discovery, local exploration
- **Secondary**: Travelers looking to meet locals; event-goers; remote workers seeking IRL community
- **Tertiary**: Local businesses wanting foot-traffic engagement

---

## Brand Identity

- **Name**: vibr8.me — playful, phonetic, memorable
- **Tagline**: *Feel who's near.*
- **Tone**: Confident, warm, slightly edgy — not corporate. Feels like a product made by people who go outside.
- **Visual direction**: Minimal UI, bold haptic-inspired motion design, dark-mode first

---

## MVP Scope (v1.0)

- [ ] User onboarding + Vibe profile setup
- [ ] Background proximity detection (BLE + GPS)
- [ ] Graduated vibration patterns by distance
- [ ] Anonymous Vibe card reveal + mutual interest flow
- [ ] **Buzz Me** — one-tap haptic signal with distinct vibration pattern, proximity-gated, rate-limited
- [ ] **Visualizer** — full-screen accelerometer-driven generative art with 5 modes, activated on Buzz or long-press
- [ ] Ghost Mode toggle
- [ ] Local promo notifications (1–2 pilot partners)
- [ ] Simple nearby activity feed (manual curation initially)
- [ ] ~~In-app chat~~ — explicitly excluded by design

---

## Battery Efficiency Strategy

Battery life is a first-class concern. vibr8.me runs in the background continuously — it must feel invisible to the user's battery, not like a drain. Target: **3–6% battery per hour** in active background mode (comparable to Spotify or WhatsApp, not Pokémon GO).

### Detection layers — tiered by power cost

| Range | Technology | Estimated drain | Notes |
|---|---|---|---|
| 0–50m (strong buzz) | BLE only | ~1–3% / hr | Phone's coprocessor handles this, not main CPU |
| 50–500m (medium pulse) | Low-power GPS + geofencing | ~4–8% / hr | Use significant location change mode, not continuous GPS |
| City-level (promos, events) | Cached + periodic fetch | Negligible | Update every 15–30 min, not continuously |

### Engineering rules

**BLE is the primary proximity tool.** For short-range detection — the moments that matter most — BLE scanning should do all the work. It uses a fraction of what GPS costs and runs on the phone's dedicated coprocessor, leaving the main CPU free.

**Never use continuous high-accuracy GPS.** Standard continuous GPS (what mapping and Pokémon GO use) burns 15–20% battery per hour on its own. vibr8.me should use:
- iOS: `CLLocationManager` with `significantLocationChange` mode + region monitoring (geofencing)
- Android: `FusedLocationProviderClient` with `PRIORITY_BALANCED_POWER_ACCURACY` or `PRIORITY_LOW_POWER`

**Batch all background work.** Compatibility scoring, feed updates, and promo fetches should run in batched background tasks — not on a continuous timer. Use iOS `BGAppRefreshTask` and Android `WorkManager` to schedule updates when the phone is idle or charging.

**The radar map does not update in the background.** The UI only refreshes when the user opens the app. No live rendering in the background — the vibration engine is the background process, not the map.

**Geofencing for establishment promos.** Instead of polling for nearby promos constantly, register geofences around partner establishments. The OS triggers a push only when the user enters the radius — near-zero background cost.

**Ghost Mode = full stop.** When the user enables Ghost Mode, all background location and BLE scanning halts completely. No exceptions.

### User-facing transparency

- Show a battery usage indicator in Settings ("vibr8 used X% in the last 24h")
- Offer a **Low Power Mode** in-app that reduces BLE scan frequency and disables city-level feed refresh
- Clearly communicate in onboarding what background permissions are used and why

---

## Open Questions / To Explore

- What's the optimal vibration pattern UX? (User testing needed)
- Age verification and safety moderation strategy
- Partnership acquisition strategy for launch city
- Should "Dating" mode be a separate product or a Vibe within the same app?
- Android BLE background scanning restrictions vary by OEM — how do we handle aggressive battery optimization on Samsung/Xiaomi?

---

*Last updated: April 2026 — Initial concept draft*
