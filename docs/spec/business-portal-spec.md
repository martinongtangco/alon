# vibr8.me — Business Portal Specification

## Overview

The **Business Portal** is the self-serve web application for partner establishments — bars, cafes, gyms, co-working spaces, and any business participating in vibr8.me's proximity promo and event ecosystem. It is the primary interface through which partners configure their broadcast presence, manage offers, track performance, and handle billing.

It is entirely separate from the consumer mobile app and from the internal Admin Dashboard. Partners never interact with the admin panel; admins never use the Business Portal to manage individual accounts on a partner's behalf.

> The portal's job is to make a bar owner feel in control of their vibr8.me footprint in under 10 minutes — without needing a sales call or an engineer.

---

## Users

**Primary user**: The business owner or marketing manager at a partner establishment. Non-technical. Wants results fast. Does not want to read documentation.

**Secondary user**: An agency or contractor managing multiple partner accounts (future consideration — not in v1 scope).

---

## Authentication & Onboarding

- Partners register via a public signup page (linked from the vibr8.me marketing site)
- Registration collects: business name, category, address, contact name, contact email, plan selection
- New accounts enter **Pending Review** status — activation requires admin approval in the Admin Dashboard
- On approval, the partner receives a confirmation email and gains full portal access
- First login triggers a 5-step onboarding checklist:

```
Step 1 — Basic Info       Business name, category, about text
Step 2 — Location         Address + map pin + broadcast radius
Step 3 — Vibe Tags        Select up to 5 Vibes that describe the venue
Step 4 — Hours            Operating days and times
Step 5 — Verify           Identity/business verification (TBD — see Open Questions)
```

- The checklist persists in the sidebar until all steps are complete
- Partners can publish promos and events before completing all steps, but reach is reduced until the profile is verified

---

## Navigation Structure

```
vibr8.me Business Portal
├── Dashboard              Overview stats, live promo status, recent redemptions
├── Analytics              Deeper metrics — impressions, conversions, peak hours
├── Promos                 Create, edit, pause, and delete proximity offers
├── Events                 Create and publish events to the Nearby Feed
├── Business Profile       Identity, location, Vibe tags, operating hours
├── Billing & Plan         Subscription management, payment, invoices
└── Settings               Notifications, account details, danger zone
```

---

## Features

### 1. Dashboard

The first screen after login. Designed to be glanceable — a partner should understand their week's performance in under 30 seconds.

**Metric cards (top row):**
- Buzz Impressions — how many times the business's promo zone was entered by an active user
- Promo Redemptions — confirmed redemptions across all active promos
- Avg. Radius Reach — the configured broadcast radius (informational)
- Active Events — count of currently live or upcoming events

**Weekly Impressions chart** — a 7-day bar chart showing daily impression volume. No date-picker in v1; always shows the trailing 7 days.

**Live Promos panel** — a compact list of active promos with a toggle (on/off), a progress bar showing redemptions vs. limit, and a count. Partners can pause promos directly from this panel without navigating to the Promos page.

**Recent Redemptions table** — the last 10 redemptions across all promos: promo name, timestamp, approximate user distance at redemption time, and status. No PII is shown — user identity is never exposed to partners.

---

### 2. Analytics

Expanded metrics for partners who want to go deeper. Available on all plans.

**Metrics exposed:**
- Total impressions and redemptions over the selected period
- Conversion rate (redemptions / impressions)
- Average user distance at redemption
- Impressions breakdown by promo
- Impressions breakdown by Vibe tag (which user Vibes drove the most engagement)
- Peak engagement hours — a 24-hour bar chart showing when users triggered the promo zone most frequently

**Period selector**: Last 7 days / Last 30 days / Last 90 days.

**Export**: CSV export of raw redemption data (timestamp, promo ID, approx. distance). No user PII in the export.

---

### 3. Promos

The core content management tool for partners. A promo is a proximity-triggered offer that appears as a notification to vibr8.me users when they enter the broadcast radius.

**Promo list view:**
- Tab filters: All / Active / Drafts / Expired
- Each promo card shows: headline, status badge, radius, daily limit, redemption count, progress bar
- Inline toggle to pause/resume without opening the editor
- Delete and Edit actions per card

**Creating / editing a promo:**

| Field | Description |
|---|---|
| Headline | Short offer text — what the user sees in the notification |
| Description | Longer copy shown when the user taps into the promo — instructions for claiming |
| Broadcast Radius | 25m – 200m (upper limit depends on plan tier) |
| Daily Redemption Limit | Cap on how many times the promo can be claimed per day |
| Start / End Date | Date range for the promo to be active |
| Active Days | Day-of-week selector — e.g. Fridays and Saturdays only |
| Status | Draft (not broadcasting) or Published (live) |

**Plan limits on promo radius:**

| Plan | Max Radius |
|---|---|
| Partner Basic | 75m |
| Partner Pro | 200m |
| Enterprise | 200m + geofence overrides |

**Promo guardrails (enforced by the system):**
- Redemption limit cannot be set to "unlimited" — minimum 1, maximum set by admin config
- Promos with no end date auto-expire after 90 days
- Partners are notified at 90% redemption capacity

---

### 4. Events

Partners can list events in the vibr8.me Nearby Activities Feed. Events reach users whose Vibe profiles overlap with the event's tags, within the city/area.

**Event list view:**
- Tabs: Upcoming / Live Now / Past
- Table columns: event name, date/time, Vibe tags, status, estimated reach, featured toggle
- Events in Draft status are not visible to users

**Creating / editing an event:**

| Field | Description |
|---|---|
| Event Name | Display name in the Nearby Feed |
| Description | What to expect — tone should match the venue |
| Date | Single date (recurring events are not supported in v1) |
| Start / End Time | Event window |
| Category | Music & Concerts, Food & Drinks, Networking, Sports & Fitness, Arts & Culture, Games & Trivia |
| Vibe Tags | Up to 3 Vibes — determines which users see the event |
| Cover Image | Optional image shown in the feed card |
| Featured | Paid boost — bumps event to top of Nearby Feed (₱500/event, charged separately) |

**Event moderation**: All community-submitted events require admin approval before going live. Business partner events on verified accounts are auto-approved unless flagged.

---

### 5. Business Profile

The identity and configuration layer for the partner's vibr8.me presence.

**Identity section:**
- Business logo (optional)
- Business name
- Category (Bar & Nightlife, Cafe, Restaurant, Gym & Fitness, Co-working, Retail, Events Venue)
- About text — shown to users who tap on a promo or event card

**Contact section:**
- Website URL
- Phone number
- Instagram handle

**Location & Broadcast Zone:**
- Street address
- Interactive map pin (for precise geofence placement)
- Default broadcast radius slider — sets the default for new promos (each promo can override this)

**Vibe Tags:**
- Select up to 5 Vibes that describe the venue
- These determine which users are most likely to receive proximity triggers
- Tags are curated by admin — partners select from the approved list, cannot create custom tags

**Operating Hours:**
- Day-of-week selector + open/close time
- Used to suppress promo broadcasts outside operating hours (configurable — off by default in v1)

---

### 6. Billing & Plan

**Plan display:**
- Current plan name, price, billing cycle
- Feature list with included vs. excluded items clearly marked
- Upgrade CTA to the next tier

**Available plans:**

| Plan | Price | Max Radius | Promos | Events | Analytics |
|---|---|---|---|---|---|
| Partner Basic | ₱1,990/mo | 75m | 3 active | ✓ | Basic |
| Partner Pro | ₱4,990/mo | 200m | Unlimited | ✓ | Full |
| Enterprise | Custom | 200m + custom | Unlimited | Priority placement | Full + exports |

**Payment:**
- Credit card on file (Stripe or local payment gateway — TBD)
- Billing history with downloadable receipts
- Next renewal date and amount prominently displayed
- Self-serve cancellation — subscription ends at end of billing period, not immediately

**Event boosts** are charged as one-time line items, not part of the monthly subscription.

---

### 7. Settings

- **Notification preferences**: Email alerts for redemptions, weekly digest, low-balance alerts, billing reminders
- **Account details**: Contact name and email for the account
- **Danger Zone**: Delete business account (permanent, requires confirmation)

---

## Design Principles

- **Dark-mode only.** Matches the vibr8.me brand — amber (`#F5A623`) on near-black. No light mode in v1.
- **No marketing speak.** Every label is a plain description of what the thing does. Partners are busy.
- **Confidence at a glance.** The dashboard should make a partner feel good about their vibr8.me investment within seconds of opening it.
- **Non-intrusive data.** User PII is never shown to partners — not names, not photos, not exact locations. Only aggregate metrics and approximate distances.

---

## Technical Notes

- Web application — no native app in v1
- Responsive to tablet; desktop-primary layout
- Authentication: email + password, with future SSO option for enterprise accounts
- Session: standard JWT with refresh token
- API: consumes the same backend as the mobile app — partner-scoped endpoints only
- File uploads (logo, event cover image) go through the same CDN pipeline as app assets

---

## Out of Scope (v1)

- Multi-user accounts (e.g. agency managing multiple businesses) — planned for v2
- Real-time map preview of broadcast zone with live user density
- A/B testing tools for promo copy
- Direct messaging between partner and vibr8 team through the portal
- Recurring event templates
- Custom Vibe tag creation

---

## Open Questions

- What is the business verification flow? ID upload? Business registration number? Manual admin review only?
- Should operating hours suppress broadcasts automatically, or leave it to the partner to manually pause?
- How do we handle multi-location businesses (chain gyms, cafe groups)?
- Is ₱500/event featured boost the right price point? Needs validation.
- What payment gateway works best for Philippine market (GCash, Maya, card)?

---

*Last updated: April 2026 — Initial draft, based on Business Portal v1 prototype*
*Reference implementation: `vibr8me_business_portal.html`*
