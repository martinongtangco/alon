# ADR 0029: M2 — Push Notification Strategy

Status: Accepted
Date: 2026-05-14
Milestone: M2
Depends on: [ADR 0010](0010-app-schema-data-model.md), [ADR 0015](0015-app-api-topology.md), [ADR 0028](0028-m2-ios-platform-extension.md)

## Context

M1 has no push notifications (ADR 0012). M2 introduces three notification use cases:

1. **Buzz Me received** — someone nearby sent the user a Buzz Me signal.
2. **Mutual reveal** — a reveal became mutual; the user has a new match.
3. **Promo trigger** — the user entered the geofence of a partner establishment.

Each case has different delivery timing and sensitivity. The architecture must handle both foreground (app open) and background (app closed) delivery, across Android and iOS.

## Decision

### Library — Expo Notifications

`expo-notifications` (`expo-notifications@~0.28`) is the cross-platform push notification library for Expo managed workflow. It wraps:
- Android: Firebase Cloud Messaging (FCM)
- iOS: Apple Push Notification service (APNs)

Expo's push service acts as an intermediary — the backend sends to `https://exp.host/--/api/v2/push/send` using an Expo push token, and Expo forwards to FCM/APNs. This avoids managing separate FCM and APNs credentials for M2. The tradeoff is a dependency on Expo's push infrastructure; raw FCM/APNs can be adopted in M3 if latency or reliability becomes a concern.

### Push token registration

At bootstrap (ADR 0024 Phase 1), after device registration succeeds:

```ts
// app/src/services/bootstrap.ts — add after registerDevice()
import * as Notifications from 'expo-notifications';

const { status } = await Notifications.requestPermissionsAsync();
if (status === 'granted') {
  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
  await apiService.registerPushToken(expoPushToken);
}
```

New endpoint:
```
POST /api/push-token
Auth: device JWT
Body: { token: string }   // Expo push token
Response: { ok: true }
```

The backend stores the push token in `app.users.push_token` (new column, nullable). Devices that have not granted notification permission have `push_token = NULL` and receive no push notifications — they fall back to in-app polling for matches.

### Notification use cases

#### 1. Buzz Me received

When `POST /api/buzz` is processed and the rate-limit check passes, the backend looks up the push token for the target device (identified by the proximity token → deviceId chain in Redis) and sends a notification:

```json
{
  "to": "<target-push-token>",
  "title": "someone buzzed you",
  "body": "open Alon to see who's nearby",
  "data": { "type": "buzz" }
}
```

No sender identity is included in the notification payload — the recipient sees only that *someone* buzzed them. Tapping the notification opens the app to the Radar screen.

#### 2. Mutual reveal

When a mutual reveal is confirmed (ADR 0027), the backend sends notifications to both devices:

```json
{
  "title": "new match",
  "body": "you and someone nearby both revealed",
  "data": { "type": "reveal", "matchId": "<uuid>" }
}
```

Tapping navigates to the Matches screen. The `matchId` in the data payload lets the app deep-link directly to the match entry.

#### 3. Promo trigger

Promo geofencing is handled client-side using Expo Location's geofencing API (`expo-location`). When the device enters a registered geofence, the OS fires a background task that posts a local notification (not a push notification from the server):

```ts
// local notification, no server round-trip
await Notifications.scheduleNotificationAsync({
  content: {
    title: promo.label,
    body: promo.detail,
    data: { type: 'promo', promoId: promo.id },
  },
  trigger: null, // immediate
});
```

The geofence list is downloaded from `GET /api/promos` on hydration (ADR 0024) and registered with `expo-location`'s geofencing API. No server-to-client push is needed for promos — the device already has the promo data and detects entry locally. This eliminates per-user location tracking on the server (privacy) and removes one class of push volume.

### Notification handling

```ts
// App.tsx — add after navigator mounts
Notifications.addNotificationResponseReceivedListener((response) => {
  const { type, matchId } = response.notification.request.content.data;
  if (type === 'buzz') navigation.navigate('Radar');
  if (type === 'reveal') navigation.navigate('Matches');
  if (type === 'promo') navigation.navigate('Feed');
});
```

In-app notifications (app is foregrounded) are suppressed by default — the app handles them by updating the relevant Zustand slice via polling rather than showing an OS banner.

### Delivery guarantees

Push notifications are best-effort. The backend fires and forgets — no delivery receipt is tracked in M2. A failed push (invalid token, user disabled notifications) is logged as a warning and silently dropped. The app's polling mechanism (matches, feed) ensures the user sees the update on next poll regardless of push delivery.

## Alternatives considered

**Raw FCM + APNs without Expo** — requires separate credential management (FCM service account JSON, APNs `.p8` key), separate send logic per platform, and more backend surface area. The parity benefit is marginal in M2. Rejected; revisit at M3 if Expo push becomes a bottleneck.

**Server-Sent Events for real-time in-app delivery** — better UX than polling for in-app delivery but requires a persistent authenticated connection. Deferred to M3 (also noted in ADR 0027).

**Geofence promos via server push** — requires the server to track user locations (or register geofences on the user's behalf), which violates the privacy model. Local geofencing is the correct approach. Rejected.

**WebSockets** — same trade-off as SSE with additional connection state management. Rejected for M2.

## Consequences

- New dependency: `expo-notifications@~0.28`. Requires Expo SDK 51+ (already the baseline for M2 build).
- `app.users` gains a nullable `push_token TEXT` column. M2 migration adds this column.
- Backend gains two new route files: `routes/app/push-token.ts` (register token) and push-send logic added to `routes/app/buzz.ts` and the reveal handler in `routes/app/matches.ts`.
- Buzz Me now has a server-side cross-device effect: the buzzer's device triggers a notification on the buzzed device. This requires the backend to resolve the target device's push token from a proximity token — the same token resolution chain used for vibe matching (ADR 0026). No new architecture is needed.
- Push notifications add a privacy surface: Expo's push service sees the push token and notification content. No PII (name, location) is included in notification payloads — only `type` and `matchId` (a UUID). This is acceptable.
- Android 13+ requires `POST_NOTIFICATIONS` runtime permission. This is requested via `Notifications.requestPermissionsAsync()` which handles both platforms. The permissions flow in `OnboardingScreen` should reference notifications alongside BLE permissions.
