# ADR 0027: Push Notification Provider and Delivery Strategy

Status: accepted

M2 introduces two notification triggers: a mutual reveal match and proximity-triggered promo offers from partner establishments. The decision covers provider choice, the delivery model, and Ghost Mode interaction.

## Decision

### Provider

**Expo Notifications** (`expo-notifications`) as the cross-platform wrapper over FCM (Android) and APNs (iOS). Expo handles token registration, credential management, and the send API in a single package that works with the existing Expo-managed build. No separate FCM/APNs SDK integration is needed.

Push tokens are stored in `app.users.push_token` (new column, nullable). Tokens are registered on app launch after permissions are granted and updated on rotation.

### Notification types

| Type | Trigger | Delivery | Ghost Mode |
|---|---|---|---|
| `MATCH` | Both sides reveal (ADR 0025) | Immediate, server-sent | Sent regardless — user chose to reveal |
| `PROMO` | User enters establishment geofence | OS-triggered geofence callback → local notification | Suppressed |

**MATCH notifications** are sent server-side via the Expo Push API (`https://exp.host/--/api/v2/push/send`) at the moment `app.reveals` is updated to MATCHED. The backend calls this endpoint directly — no queue for M2. Payload: `{ title: "You matched!", body: "<name> wants to connect." }`. No user ID or location in the payload.

**PROMO notifications** are local — the OS fires a geofence entry event, the app constructs and displays the notification on-device without a server round-trip. Geofence regions are registered when the app fetches the promo feed. This keeps promo delivery near-zero battery cost (OS-managed geofencing) and requires no always-on server connection.

### Permissions

Notification permission is requested during onboarding, after BLE permissions (existing permissions step in `app/src/screens/Onboarding/index.tsx`). Permission is optional — the app works without it; users simply miss match and promo alerts.

### Ghost Mode

Ghost Mode suppresses all PROMO notifications (geofence callbacks check ghost state before displaying). MATCH notifications are not suppressed — the user actively initiated the reveal, so receiving the match confirmation is expected behaviour.

### Backend changes

- New column: `ALTER TABLE app.users ADD COLUMN push_token TEXT;`
- New endpoint: `POST /api/device/push-token` — device JWT auth, body `{ token: string }`, upserts `push_token` on `app.users`.
- `backend/src/services/push.ts` — thin wrapper around the Expo Push API: `sendMatchNotification(userId, matchName)`.
- Called from the reveal mutation in `backend/src/routes/app/reveals.ts` (ADR 0025) when status transitions to MATCHED.

## Alternatives considered

**Direct FCM + APNs integration** — more control, no Expo dependency. Rejected: requires separate credential management per platform and native configuration. Expo Notifications eliminates this for an Expo-managed build at no meaningful cost.

**Server-sent promos (push from backend on geofence)** — requires always-on location reporting to the server to know when a user enters a geofence. Rejected: violates the privacy principle (no continuous location sharing) and burns battery.

**Queue all push sends (SQS/BullMQ)** — ensures delivery under load. Deferred to M3: M2 volume does not warrant a queue. Direct Expo API call with a logged warning on failure is sufficient.

## Consequences

- New package: `expo-notifications` (pre-authorized under the Expo managed workflow, no new ADR needed).
- `app.users` gains `push_token TEXT` column — add to `db-setup.sql` and migration.
- Onboarding flow gains a notification permission step after BLE permissions.
- Ghost Mode store action must suppress geofence notification callbacks.
