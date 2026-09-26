# Native activity notifications

Persistent in-app notifications remain authoritative. No lifecycle request sends a push.

## Configuration required before enabling delivery

The repository has no assigned EAS project ID or checked-in native credentials.
Obtain JOIN's real project UUID from the Expo/EAS project dashboard and configure:

| Location | Variable | Value |
| --- | --- | --- |
| Frontend build environment (or frontend/.env) | EXPO_PUBLIC_EAS_PROJECT_ID | The actual project UUID |
| Backend environment | EXPO_PROJECT_ID | The same project UUID |
| Backend environment | EXPO_PUSH_ENABLED | true when ready to send; otherwise delivery stays disabled |
| Backend environment | EXPO_ACCESS_TOKEN | Server-only Expo access token if enhanced push security is enabled |

An existing `extra.eas.projectId` is also preserved. No fallback project ID is invented.
Missing/invalid frontend project IDs skip registration; an unconfigured backend
returns 503 for registration. Never put EXPO_ACCESS_TOKEN into frontend extras.

Provision iOS APNs and Android FCM credentials for this EAS project and the real
bundle/application identifiers. Configure the appropriate Android google-services
file in Expo native configuration. These identifiers/files are not fabricated here.
Create a fresh native development/production build with the expo-notifications
plugin and SDK-compatible expo-device/expo-crypto modules; a web export does not
validate native credentials. The repository uses Expo SDK 48-era dependencies:
verify current EAS/store support and native build compatibility separately before
release. No Expo SDK upgrade is included in this change.

References: [Expo delivery API](https://docs.expo.dev/push-notifications/sending-notifications/)
and [native credential setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## Storage and delivery

New Notification records carry a private `pushPending` marker. The worker creates
PushDelivery rows, unique per notification/device, before clearing that marker.
Older Phase 1 records are not backfilled. Read or more-than-one-day-old notifications
are skipped. No devices at scheduling time means no later replay on a new login.

PushDevice has one random installation ID, one unique Expo token, one current user,
platform, project ID, registration generation, last-seen time and revocation time.
Multiple installations per user are supported. Tokens are excluded from default
queries and never returned in API payloads. A changed owner/token or reactivation
rotates the generation; queued jobs and delayed logout/receipt operations cannot
affect a newer generation. A token already assigned to a different installation
returns 409 rather than overwriting it. If installation storage was lost but Expo
reused the token, the stale device record needs to be removed before registering.

Legacy User.pushToken remains hidden and inert solely for migration compatibility.
It is cleared on successful device registration. Those tokens are not imported:
their platform, installation ownership and consent cannot be reliably inferred.
Old PATCH /api/users/me/push-token clients receive 410 and need an app update.

The worker runs every five seconds, serializes each process's ticks, claims jobs
atomically across processes, and sends batches of at most 50 through Expo's HTTP
API. Generic type-based copy contains no activity title, location, invite code,
profile details or message text. Data includes notificationId, type and activityId.
Future push preference checks belong immediately before dispatch, independently
of inbox persistence.

Tickets are stored durably. Receipts are checked after 15 minutes, with at most
eight hourly checks when missing/unavailable. An 'ok' receipt means provider
acceptance, not proof of display. DeviceNotRegistered/invalid tokens are revoked;
90-day-inactive registrations are also revoked.

Explicit HTTP 429/5xx rejections and MessageRateExceeded responses retry with
exponential delays, up to four dispatch attempts total. Other permanent errors
are terminal. Unknown transport outcomes, malformed replies, or a crash after
dispatch began are recorded as `unknown` and not automatically resent. Expo does
not offer a request idempotency key: this policy favors avoiding duplicate alerts
over guaranteed push delivery. The in-app notification is always retained.
There is no automatic delivery-history retention policy in this phase.

## Native behavior

Authenticated startup (including restored sessions), app activation and native
token rotation refresh registration. Permission is requested at most once by JOIN
while undetermined; denied/unsupported/web states safely skip registration.
Logout attempts revocation before clearing authentication and still completes
offline. If that request cannot reach the server, server revocation cannot be
guaranteed until re-registration, expiry or an invalid-token receipt. Copy remains
generic and taps always require authenticated notification ownership.

Android uses the silent 'Activity updates' channel. Foreground notifications show
an alert/banner/list entry without sound or icon-badge updates and refresh the
existing in-app unread counter. No second local notification is created.

Tap listeners and the last native response support running, background and cold
starts. Routing waits for authentication and navigation readiness, validates typed
IDs, fetches the recipient-owned notification, marks it read where possible and
checks Activity access before navigating. Missing/unauthorized/network-failed
targets fall back to Notifications. Recent handled notification IDs are persisted
to avoid replay navigation. A failed tap can be retried from the in-app inbox.

## Verification

Backend: `npm run test:push` (isolated MongoDB; Expo HTTP calls mocked).
Frontend: `npm run test:push` (React renderer; native APIs mocked).
Also run both notification suites, lifecycle regression suites, typechecks and
the frontend web build. MongoDB test binary download may be required on first run.

Before enabling production push, use physical iOS/Android builds to verify actual
credential delivery, Android channel behavior, foreground/background/cold-start
taps, permission denial, token rotation, account switching and offline logout.
No browser push, preferences UI, chat-message or Moment push events are included.
