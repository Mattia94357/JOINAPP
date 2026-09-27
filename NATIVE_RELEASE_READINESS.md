# JOIN native closed-beta readiness

Audit date: 2026-09-27. This document describes the repository after the safe
configuration pass. It does not claim that a native binary was built.

## Current stack and workflow

- Managed Expo / Continuous Native Generation: no checked-in `ios` or `android`
  directories and no custom native code.
- Declared/resolved Expo: `^48.0.0` / `48.0.21`; React Native `0.71.14`;
  React `18.2.0`.
- Node is pinned to `22.20.0` (`>=22 <23`) and npm to `10.x`. Those are the
  versions used for this audit. Re-evaluate only at an SDK release boundary.
- npm is authoritative. The root npm lock owns both workspaces and Vercel/EAS
  installs. `backend/package-lock.json` independently owns Render's `backend`
  root-directory install. There is intentionally no frontend-only lockfile.
- Expo config now generates display name `JOIN`, slug `joinapp`, scheme `join`,
  version `1.0.0`, iOS build `1`, and Android version code `1`.
- iOS bundle ID and Android application ID are not present in repository history
  or an Expo account configuration. They must be selected/registered by the
  owner and supplied as `EXPO_IOS_BUNDLE_IDENTIFIER` and
  `EXPO_ANDROID_PACKAGE`; no reverse domain was fabricated.

## Release configuration gates

Preview and production EAS config evaluation fails early unless all of these are
present: public HTTPS API URL, owned HTTPS app-link URL, real EAS project UUID,
both registered app identifiers, and HTTPS privacy, terms, community, support,
and deletion URLs. Development still permits explicitly local endpoints.

One EAS project must be authoritative:

1. Sign in to the intended Expo owner from `frontend`.
2. Run `eas init` and select/create the actual JOIN project.
3. Put the returned UUID in EAS environment variable
   `EXPO_PUBLIC_EAS_PROJECT_ID`.
4. Put the same UUID in backend `EXPO_PROJECT_ID`.
5. Do not enable backend `EXPO_PUSH_ENABLED=true` until APNs/FCM credentials and
   physical-device delivery have been verified.

`frontend/eas.json` contains internal development/preview profiles (Android APK)
and a store production profile (default Android AAB) with automatic build-number
increments. There is no submit profile. Add `expo-dev-client` at the
SDK-compatible version during the migration if an interactive dev-client build
is wanted; the current development profile is an internally distributed test
binary without that dependency.

## API, backend URLs, and links

- A non-development client rejects a missing, malformed, non-HTTPS, localhost,
  loopback, or private-LAN API URL. There is no production localhost fallback.
- Backend `CORS_ORIGINS` is an exact comma-separated origin list.
  `PUBLIC_APP_URL` and `PASSWORD_RESET_BASE_URL` are independent single HTTPS
  URLs. Production startup validates all three. Password reset never uses the
  CORS list.
- Custom links use `join://`; owned HTTPS links are added only through
  `EXPO_PUBLIC_APP_URL`. No unowned `joinapp.app` fallback remains.
- Activity, private-invite query code, public-profile, forgot-password, and
  reset-password routes are configured. An unauthenticated activity link can
  show the privacy-safe preview, offer login, and restore that activity after
  authentication. Reset links also work when a session already exists.
- Stale activity/profile/push targets retain existing safe error/fallback paths.
- Universal Links and Android App Links still require an owned HTTPS domain,
  Apple association file, Android asset links file, and final app identifiers.
  The custom scheme works independently but must be device-tested.

## Native permissions and push

- Location copy states that permission is used when Map Mode is opened to show
  nearby activities. JOIN requests location in feature context, not at launch.
  SDK 48's location plugin unconditionally adds unused iOS “always” descriptions
  and Android foreground-service permission, so current foreground-only location
  declarations are centralized directly in dynamic app config. Re-evaluate the
  newer location plugin at each migration step.
- Photo and camera copy covers profile, activity, and Moment images. The picker
  plugin disables microphone permission; the unused photo-library-add usage
  description was removed.
- Notifications remain requested after authentication by the existing push
  registration flow. Missing/invalid project configuration skips registration
  or returns a controlled backend response; it does not crash the app.
- `expo-notifications` is a config plugin. Android already creates the runtime
  “Activity updates” channel. No custom sound or background remote notification
  entitlement is requested.
- Before device push testing: link EAS, register IDs, configure APNs, configure
  FCM v1/Google services for the same Android package, set EAS build variables,
  set the matching backend UUID/access token/enable flag, rebuild, then test
  permission denial, token rotation, foreground/background/killed taps, account
  switching, and offline logout.

## Assets, legal links, and account deletion

The only brand asset is `frontend/assets/join-icon.svg` (1024 x 1024 canvas).
Expo native config has no production raster assets, so none were wired blindly.
Before building, a designer/owner must export and approve:

- 1024 x 1024 square PNG app icon, opaque and without platform-added rounding;
- Android adaptive foreground PNG plus background color/image with safe-zone
  composition;
- splash image/logo PNG sized for Expo's splash plugin plus approved background;
- Android notification icon: 96 x 96 all-white transparent PNG.

Add those paths to the app icon, Android adaptive icon, splash plugin, and
`expo-notifications` plugin after the SDK migration. The current background-only
splash is valid but not branded; default notification imagery is not release
quality.

Privacy, Terms, Community Guidelines, Support, and web account-deletion URLs are
unset rather than pointed at a guessed domain. Preview/production builds are
blocked until real owned, published, reachable HTTPS URLs are provided. Settings
exposes the first four. Native account deletion remains directly accessible at
Settings > Delete account, requires confirmation and authentication, logs out on
success, and leaves the action available for retry after a displayed error.
`DELETE_ACCOUNT_URL` is for the store listing/web deletion requirement.

## Native compatibility matrix

Versions below come from Expo's official `bundledNativeModules.json` for each SDK
branch. At every row, install the indicated Expo major, run
`npx expo install --fix`, and do not manually combine versions from two rows.

| SDK | React / RN | Async storage | Crypto / Device | Image manipulator / picker | Location / Notifications |
| --- | --- | --- | --- | --- | --- |
| 48 current | 18.2.0 / 0.71.14 | 1.17.11 | ~12.2.1 / ~5.2.1 | ~11.1.1 / ~14.1.1 | ~15.1.1 / ~0.18.1 |
| 49 | 18.2.0 / 0.72.12 | 1.18.2 | ~12.4.1 / ~5.4.0 | ~11.3.0 / ~14.3.2 | ~16.1.0 / ~0.20.1 |
| 50 | 18.2.0 / 0.73.6 | 1.21.0 | ~12.8.1 / ~5.9.4 | ~11.8.0 / ~14.7.1 | ~16.5.5 / ~0.27.8 |
| 51 | 18.2.0 / 0.74.5 | 1.23.1 | ~13.0.2 / ~6.0.2 | ~12.0.5 / ~15.1.0 | ~17.0.1 / ~0.28.19 |
| 52 | 18.3.1 / 0.76.9 | 1.23.1 | ~14.0.2 / ~7.0.3 | ~13.0.6 / ~16.0.6 | ~18.0.10 / ~0.29.14 |
| 53 | 19.0.0 / 0.79.6 | 2.1.2 | ~14.1.5 / ~7.1.4 | ~13.1.7 / ~16.1.4 | ~18.1.6 / ~0.31.5 |
| 54 | 19.1.0 / 0.81.5 | 2.2.0 | ~15.0.9 / ~8.0.10 | ~14.0.8 / ~17.0.11 | ~19.0.8 / ~0.32.17 |
| 55 | 19.2.0 / 0.83.10 | 2.2.0 | ~55.0.19 / ~55.0.21 | ~55.0.21 / ~55.0.24 | ~55.1.14 / ~55.0.27 |
| 56 | 19.2.3 / 0.85.3 | 2.2.0 | ~56.0.5 / ~56.0.4 | ~56.0.26 / ~56.0.25 | ~56.0.26 / ~56.0.25 |
| 57 target | 19.2.3 / 0.86.3 | 2.2.0 | ~57.0.3 / ~57.0.2 | ~57.0.20 / ~57.0.20 | ~57.0.20 / ~57.0.21 |

| SDK | Gesture / Maps / Reanimated | Safe area / Screens | SVG / WebView | Vector / Font / Haptics / Status bar / RN web |
| --- | --- | --- | --- | --- |
| 48 current | ~2.9.0 / 1.3.2 / ~2.14.4 | 4.5.0 / ~3.20.0 | 13.4.0 / ^11.26.0 | ^13.0.0 / ~11.1.1 / ~12.2.1 / ~1.4.4 / ~0.18.11 |
| 49 | ~2.12.0 / 1.7.1 / ~3.3.0 | 4.6.3 / ~3.22.0 | 13.9.0 / 13.2.2 | ^13.0.0 / ~11.4.0 / ~12.4.0 / ~1.6.0 / ~0.19.6 |
| 50 | ~2.14.0 / 1.10.0 / ~3.6.2 | 4.8.2 / ~3.29.0 | 14.1.0 / 13.6.4 | ^14.0.0 / ~11.10.3 / ~12.8.1 / ~1.11.1 / ~0.19.6 |
| 51 | ~2.16.1 / 1.14.0 / ~3.10.1 | 4.10.5 / 3.31.1 | 15.2.0 / 13.8.6 | ^14.0.3 / ~12.0.10 / ~13.0.1 / ~1.12.1 / ~0.19.10 |
| 52 | ~2.20.2 / 1.18.0 / ~3.16.1 | 4.12.0 / ~4.4.0 | 15.8.0 / 13.12.5 | ~14.0.4 / ~13.0.4 / ~14.0.1 / ~2.0.1 / ~0.19.13 |
| 53 | ~2.24.0 / 1.20.1 / ~3.17.4 | 5.4.0 / ~4.11.1 | 15.11.2 / 13.13.5 | ^14.1.0 / ~13.3.2 / ~14.1.4 / ~2.2.3 / ~0.20.0 |
| 54 | ~2.28.0 / 1.20.1 / ~4.1.1 | ~5.6.0 / ~4.16.0 | 15.12.1 / 13.15.0 | ^15.0.3 / ~14.0.12 / ~15.0.8 / ~3.0.9 / ~0.21.0 |
| 55 | ~2.30.0 / 1.27.2 / 4.2.1 | ~5.6.2 / ~4.23.0 | 15.15.3 / 13.16.0 | ^15.0.2 / ~55.0.8 / ~55.0.18 / ~55.0.6 / ~0.21.0 |
| 56 | ~2.31.1 / 1.27.2 / 4.3.1 | ~5.7.0 / ~4.26.0 | 15.15.4 / 13.16.1 | ^15.0.2 / ~56.0.7 / ~56.0.3 / ~56.0.4 / ~0.21.0 |
| 57 target | ~2.32.0 / 1.27.2 / 4.5.1 | ~5.7.0 / ~4.26.0 | 15.15.4 / 13.16.1 | ^15.0.2 / ~57.0.4 / ~57.0.3 / ~57.0.1 / ~0.21.0 |

Expo does not pin the JavaScript-only `@react-navigation/native`,
`@react-navigation/native-stack`, `react-native-paper`, or `@maptiler/sdk`.
Keep Navigation 6 through SDK 51; migrate both Navigation packages together to
7.x at SDK 52, when Expo and Screens 4 meet its stated minimums. Navigation 7
changes nested `navigate` behavior, so exercise every route and push/deep-link
path. Do not use prerelease Navigation 8. MapTiler is web-only in JOIN; native
Map Mode uses `react-native-maps`, which must use the table's exact row.

Likely breaking gates and affected JOIN areas:

- SDK 49: RN 0.72 and Reanimated 2→3; all animated screens, gesture startup,
  map gestures, and web Metro resolution.
- SDK 50: Android SDK 34/AGP 8/JDK 17 and newer notification internals; native
  builds, icons, push registration/routing.
- SDK 51: Google Maps is unavailable in Expo Go on iOS and foreground location
  leaves Expo Go; use development builds for Map/location/push verification.
- SDK 52: RN 0.76, iOS minimum 15.1, optional New Architecture, notification
  trigger typing, splash behavior, Screens 4, Navigation 7.
- SDK 53: React 19, AsyncStorage 2, package exports, New Architecture default,
  Android edge-to-edge preparation. Test session restoration and all layouts.
- SDK 54: API 36/iOS 26 support, mandatory edge-to-edge behavior, Reanimated 4
  and worklets. Adopt/validate New Architecture here before advancing.
- SDK 55: New Architecture mandatory, Xcode 26 minimum, Expo modules change to
  SDK-major versioning, push no longer runs in Expo Go. Remove obsolete config
  before prebuild and use development builds.
- SDK 56: RN 0.85; full UI, Hermes, maps, image, push, and performance pass.
- SDK 57: RN 0.86.3; use `expo@57.0.17` or newer to avoid documented Hermes
  memory/startup regressions. Re-run generated config because prebuild cleaning
  behavior changed.

## Incremental migration runbook

Use a dedicated branch in the next batch and create a rollback checkpoint after
each green SDK. For each of 49, 50, 51, 52, 53, 54, 55, 56, then 57:

1. Change only to `expo@^<next>.0.0`; run `npx expo install --fix` and accept the
   versions from the matching row above. Update the npm lockfile.
2. Run `npx expo-doctor@latest` and resolve duplicate/incompatible native modules.
3. Inspect the SDK release notes and generated `npx expo config --type public`.
4. Because JOIN uses CNG, do not commit native folders. If temporary folders were
   generated, delete/regenerate them at every SDK boundary. Build a fresh native
   binary whenever a native dependency/config plugin changes.
5. Run backend/frontend typechecks, web export, and all existing critical suites.
   On devices test auth/session restoration, deletion, location, Home/Map,
   create/edit, join/request/waitlist, chat, Moments/images, notification inbox,
   push register/deliver/route, deep links/private invites, blocks/reports, and
   password reset.
6. At SDK 52, migrate Navigation 6→7 separately. At SDK 53 test New Architecture
   but retain the documented opt-out as a diagnostic. At SDK 54 make New
   Architecture green and migrate Reanimated 3→4/worklets. Only then cross the
   irreversible SDK 55 mandatory-New-Architecture boundary.
7. Tag or commit the green state (future batch only). Roll back to that point on
   a native regression rather than skipping an SDK.

Highest regression risk is maps/location permissions, Reanimated/worklets and
edge-to-edge layout, AsyncStorage-backed sessions, image picker/manipulator URI
behavior, push permissions/token acquisition/tap routing, and conditional
deep-link navigation.

## Security assessment (audit snapshot)

No `audit fix` or dependency upgrade was performed. Online root audit reported
293 advisory paths (6 low, 72 moderate, 210 high, 5 critical); production-omit
reported 220 paths. Most are the obsolete SDK 48/Expo CLI/Webpack/Metro toolchain
and are expected to collapse during the incremental SDK/Metro migration.

- Frontend Axios resolved `1.16.1`: current registry advisories require `1.18.0`.
  JOIN uses it for browser/native API calls, not the Node proxy/upload paths, but
  prototype/config parsing advisories remain a reachable client dependency.
  Upgrade and regression-test it as a separate small follow-up.
- Root workspace Mongoose resolves `7.8.9`; Render's authoritative backend lock
  resolves `7.8.11`. The latter clears the older direct prototype-pollution
  range, but npm still marks Mongoose high through its MongoDB-driver chain.
  Align and assess that chain in a separate backend dependency patch.
- Nodemailer resolves `9.0.1` in the root workspace and `9.0.3` in Render's
  backend lock. Address parsing/access-control advisories are fixed after
  `9.1.0`. JOIN sends to validated stored account email, reducing but not
  eliminating risk. Patch separately and test SMTP reset delivery.
- Backend production-only audit reports 9 paths (3 moderate, 6 high), centered
  on MongoDB/Mongoose, Nodemailer, Express/body-parser/qs, and rate-limit
  transitives. JWT has no reported finding.
- `tar@6.2.1` is under the old Expo CLI/cache install path, not the JOIN API's
  archive handling. Its critical extraction/DoS advisories are build/tooling
  risk and should disappear with the Expo CLI migration; do not process
  untrusted archives meanwhile.
- `react-native-maps` is marked through its old React Native dependency rather
  than its own advisory. Upgrade exactly with Expo at every SDK step.
- Webpack and Babel findings are build/dev/transitive. SDK 50 deprecates Expo
  Webpack in favor of Metro web, so remove `@expo/webpack-config` and redundant
  root Webpack dependencies during that step, after web parity is verified.

## Can JOIN build for beta today?

| Target | Code/config state | External/blocking state |
| --- | --- | --- |
| iOS development/internal | Profile and config gates exist; no build attempted | SDK 48 cannot meet current Xcode 26/iOS 26 upload toolchain; ID, Apple team, device provisioning, assets, EAS link, and APNs missing |
| iOS TestFlight | Store profile exists; no build attempted | Same SDK/toolchain blockers plus App Store record, distribution credentials, legal/support URLs, and review metadata |
| Android development/internal | Internal APK profiles exist; no build attempted | SDK 48 targets API 33; EAS link, package ID, assets, FCM, and physical verification missing |
| Android closed test | Production AAB profile exists; no build attempted | Google Play now requires API 36; Play record/signing, package ID, assets, legal URLs, and device verification missing |

Therefore JOIN cannot produce a credible current closed-beta store build today.
SDK 54 is the first row here that targets Android API 36 and supports iOS 26;
SDK 57 is the recommended maintained target as of the audit date. The migration
must still proceed one SDK at a time, with SDK 54 as the store-toolchain milestone
and SDK 57 as the final target.

Primary references:

- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://expo.dev/changelog/sdk-57
- https://expo.dev/changelog/sdk-55
- https://expo.dev/changelog/sdk-54
- https://docs.expo.dev/guides/new-architecture/
- https://developer.apple.com/news/upcoming-requirements/?id=04282026a
- https://developer.android.com/google/play/requirements/target-sdk
- https://docs.expo.dev/build/eas-json/
- https://docs.expo.dev/versions/latest/sdk/notifications/
