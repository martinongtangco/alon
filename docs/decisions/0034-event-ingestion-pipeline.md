# ADR 0032: Event Ingestion Pipeline (Admin CMS, M2)

Status: Accepted
Date: 2026-05-14
Milestone: M2
Depends on: [ADR 0010](0010-app-schema-data-model.md), [ADR 0005](0005-admin-dashboard-backend-topology.md), [ADR 0009](0009-audit-log-architecture.md)

## Context

The spec describes two types of content that appear on the radar and Feed screen:

- **Promos** — proximity-triggered offers from partner establishments (cafes, gyms, bars).
- **Events / Activities** — local happenings: workshops, pop-ups, meetups.

The spec notes:
> *Community-submitted and verified: workshops, pop-ups, meetups, open mics. Lightweight — not a full events platform, just a discovery nudge.*
> *Manual curation initially.*

The data model for both (`app.businesses`, `app.promos`, `app.events`) is defined in ADR 0010. What is not specified is **how content gets into these tables** and **how the app retrieves it in a location-aware way**.

## Decision

### Ingestion — admin dashboard CMS only (M2)

All content is created and managed by Alon admins through the existing admin dashboard. There is no partner self-service portal or API for external submission in M2. The admin creates all promos and events manually.

This matches the spec ("manual curation initially") and avoids building a partner-facing auth and submission flow before the product has validated market fit.

The admin dashboard gains two new pages:
- **Promos** — CRUD for `app.promos`, linked to `app.businesses`.
- **Events** — CRUD for `app.events`.

Both pages already have route stubs in `backend/src/routes/admin/promos.ts` and `backend/src/routes/admin/events.ts`. M2 implements the full read/create/update/archive operations.

### Location model

Both promos and events are stored with a **point geometry + radius**:

```sql
-- already in ADR 0010 schema:
location  GEOGRAPHY(Point, 4326)   -- PostGIS point (lon, lat)
radius_m  INTEGER                  -- metres; promo/event is active within this radius
```

The admin sets the location by entering an address (geocoded to a lat/lon via a simple geocoding call to a maps API, or by entering coordinates directly in M2). The radius is set as a number of metres.

### App retrieval — bounding-box query, no user tracking

The app fetches promos and events on hydration (ADR 0024). The request does not send the user's current location — the spec explicitly prohibits sharing location with the server.

Instead, the app sends its **grid cell** — a coarse location derived from the device's last known geofence region (a 1 km grid square). This is sufficient to filter promos and events to "roughly nearby" without revealing the user's precise position.

For M2, until geofencing is fully implemented, the `/api/promos` and `/api/events` endpoints return **all active items** (no location filter). The client filters by `distanceMeters <= radius_m` using mock/GPS distance. A full PostGIS `ST_DWithin` query is added in M3 when geofencing is live and the app has a reliable coarse location to send.

### Geofence registration (promos, client-side)

When the app hydrates and receives the promo list, it registers each promo's location as an `expo-location` geofence (ADR 0029). The device's OS monitors these geofences and fires a background task when the user enters the radius. The background task posts a local notification (ADR 0029, §Promo trigger).

No server-side geofence tracking is performed.

### Endpoint contracts

Existing stub endpoints gain implementations:

```
GET /api/promos
Auth: none (public, no location sent in M2)
Response: Array<{
  id: string,
  businessName: string,
  label: string,
  detail: string,
  emoji: string,
  distanceMeters: number,   // placeholder in M2 — set to a fixed value per promo
  bearingDeg: number,       // placeholder — derived from promo UUID via same tokenToBearing logic
  radiusMeters: number
}>

GET /api/events
Auth: none
Response: Array<{
  id: string,
  label: string,
  detail: string,
  emoji: string,
  distanceMeters: number,   // placeholder in M2
  bearingDeg: number,
  startsAt: number          // Unix ms
}>
```

The `bearingDeg` for promos and events is derived the same way as BLE peer bearing (ADR 0025) — deterministic from the item's UUID. This gives each establishment a stable angular position on the radar.

### Audit logging

All admin creates/updates/archives of promos and events pass through the existing `logAudit()` function (ADR 0009). No new audit infrastructure is needed.

## Alternatives considered

**Partner self-service portal (M2)** — requires partner auth (separate JWT issuer), a partner-facing UI, moderation workflow, and support tooling. Disproportionate for a beta with 1–2 pilot partners. Deferred to M3 when partner count justifies the surface area.

**External event ingestion API (webhooks, Eventbrite import)** — adds an integration maintenance burden before the event content strategy is validated. Manual curation lets the team control quality. Rejected for M2.

**PostGIS `ST_DWithin` query with client location in M2** — the geofencing infrastructure (which provides the coarse grid cell) is being built in parallel with this ADR. Adding a location parameter to the `/api/promos` endpoint now, before the client has reliable location data to send, would result in empty results or incorrect filtering. Deferred to M3.

## Consequences

- Admin dashboard gains two new functional pages: Promos and Events. Existing stub route files are extended.
- The app's `hydrate()` call populates the `promos` and `events` store slices with real data from the backend (replacing the current empty arrays).
- In M2, `distanceMeters` in the promo/event response is a server-side placeholder (a reasonable default radius like `100` for all items). The client does not filter by distance in M2. All active promos/events show on the radar and feed.
- A geocoding API is needed for the admin dashboard promo/event creation form. Google Maps Geocoding API or Mapbox Geocoding are both suitable. This requires an API key — add `GEOCODING_API_KEY` to the backend env vars.
- Partner onboarding (M3) will introduce a `partners` role in the RBAC system (ADR 0008). The admin CMS architecture established here does not need to change — partner-facing pages will be separate routes under a new namespace.
