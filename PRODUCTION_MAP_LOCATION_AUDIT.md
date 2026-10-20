# JOIN production map/location audit — 2026-10-20

## 1. Confirmed Vercel configuration problem

Read-only Vercel CLI inspection of the workspace-linked **frontend** project found:

| Environment | Configured variables returned by Vercel |
| --- | --- |
| Production | `EXPO_PUBLIC_API_URL` only |
| Preview | None |
| Development | None |

`EXPO_PUBLIC_MAPTILER_API_KEY` is absent in all three environments. This is a confirmed missing variable, not evidence of a malformed or origin-restricted key. No configured key exists to test those alternatives. No values were downloaded, printed or changed. The latest production deployment was inspected read-only and was Ready; its production alias includes `frontend-self-three-86.vercel.app`.

The expected pipeline is correct: Vercel's build environment → `frontend/app.config.js` → `extra.MAPTILER_API_KEY` → Expo 48 Webpack's injected `APP_MANIFEST` → `expo-constants` → `getMapTilerConfig`. The installed Expo 48 Webpack does **not** automatically expose arbitrary `EXPO_PUBLIC_*` values as browser `process.env` fields; JOIN must use the manifest bridge. A regression test now exercises the real installed production DefinePlugin with a dummy public key and verifies that it reaches the browser reader through `extra` after the process variable is removed. It also verifies that an empty `expoConfig.extra` cannot mask the populated legacy web manifest. The reader now merges the supported manifest locations rather than choosing the first truthy object.

Missing build-time configuration emits a safe warning. Runtime diagnostics identify presence, source and Vercel build environment without printing the key. The existing missing/invalid configuration overlay and alternate Leaflet map remain. Placeholder/invalid key format and HTTP provider failures remain separately diagnosed by the existing map component.

## 2. Safari classification findings and changes

The current source does not use `navigator.permissions` as authorization, and codes 2/3 do not map to denial. Browser result code 1 alone means permission denied; code 2 means position unavailable; code 3 means timeout. A reverse-geocoding/server error is caught separately and cannot change a successful browser fix into permission denied.

One concrete Retry flaw was found: even with `forceRefresh`, the service joined an existing in-flight request. A Retry after changing permission could therefore receive the previous request's denial. Forced attempts now make a separate browser request with `maximumAge: 0`. A request sequence prevents an older callback from clearing or replacing a newer cached fix, and an old request's completion cannot clear the newer request handle.

The Permissions API is now observed only for diagnostics, with missing APIs, rejected descriptors and synchronous exceptions tolerated. The actual `getCurrentPosition` callback remains authoritative even if the advisory permission state disagrees. A slow/hanging permission query never delays or suppresses geolocation. Safe `[JOIN location] geolocation-result` diagnostics contain `errorCode`, `category`, and `permissionState`; they do not contain coordinates or raw browser messages. A second observation may update `permissionState` when the Permissions API resolves after the callback. These are observations of the same request, not extra position attempts.

Read-only HTTPS inspection of the production alias returned HTTP 200 with no `Permissions-Policy` response header explicitly disabling geolocation. This does not rule out OS restrictions, another embedding context, or another domain on the phone.

**The physical iPhone's actual error callback was not available.** Site-level Allow alone cannot establish that the browser's position request succeeds. If its request returns code 1 while the permission API reports granted, the app must still report the actual denial; OS Location Services, device restrictions or context policy must then be investigated. It would be incorrect to convert that result into a successful location. The in-flight Retry bug is source-confirmed and tested, but is not proven to be the specific cause on that phone.

## 3. Phuket viewport provenance

The audited screen initializes from an in-memory `sessionMapViewport`, otherwise the neutral `WORLD_MAP_VIEWPORT`. It restores `@joinapp:last-map-viewport` from AsyncStorage/web local storage. The Leaflet document receives that screen viewport. The screen does not derive its viewport from profile text, typed activity locations or activity coordinates, and none of these map/location paths contains a hard-coded Phuket default.

Given an unavailable/denied browser fix, the eligible source of a Phuket-centered map in this code is the previously saved/session viewport. The phone's actual storage was not readable here, so the historical record and whether it came from storage or the current session are not independently inspected. New `viewport-restored` diagnostics distinguish those sources without coordinates.

Restored areas now say **“Previous map view only. Not your current location.”** A successful actual fix removes that stale-view label and centers the map. The saved viewport gains a `savedAt` timestamp; legacy plain viewport records remain readable for visual continuity. Neither new nor legacy records authorize a current region, and there is no current-user dot when location is unavailable. No viewport means a neutral world map. The alternate map and all existing Map interactions remain.

## 4. Current-region / Passport safeguards

Region registration now requires the acquisition timestamp from an actual position result. The server accepts captures at most two minutes old, with up to 30 seconds future clock tolerance. It records `source: device` and `observedAt`, and expires the allowed region five minutes after that capture. Re-registering the same old point cannot extend its lifetime. Old region documents without provenance or with old observation times fail closed even if their old `expiresAt` is still in the future. The geospatial radius remains 50 km.

The picker clears its previously acquired region when retry starts. Publishing requests a fresh device fix, registers it, checks the selected meeting point against that new region, and only then calls activity creation. A denied/timed-out/unavailable fix leaves the draft intact and asks for location retry. Typed text, old Profile location and a stale Phuket viewport cannot supply this fresh result. Out-of-region places still use the existing Passport Mode message; no payment or Passport feature was added.

As with any browser geolocation implementation, coordinates/timestamps are client-reported rather than cryptographic proof of physical presence. These checks prevent reuse of stale data by JOIN's normal client and enforce server freshness/provenance; they are not GPS-spoofing attestation.

The frontend/backend registration payload changes are paired: a later release must include both, and old clients must reload. Existing legacy regions deliberately require a new actual position. No production data migration or deployment was performed.

## 5. Required Vercel action — not performed

In the **frontend Vercel project**, add exactly:

`EXPO_PUBLIC_MAPTILER_API_KEY` = an existing valid **public/browser MapTiler key**, scoped to **Production**. Add Preview separately if preview deployments need the primary map. The optional style variable is `EXPO_PUBLIC_MAPTILER_MAP_STYLE`; the current default remains `streets-v4-dark`.

After verification and deployment authorization, create a fresh production build with that variable available. Changing a Vercel variable does not modify an already generated JavaScript bundle. Retain the alternate map. Restrict the public key to the intended JOIN origin(s) in MapTiler, including approved preview origins if applicable. Do not put private backend storage credentials or the separate `MAPTILER_SERVER_API_KEY` into the web build.

MapTiler map traffic can incur usage charges and is controlled by provider account quotas/key restrictions; the geocoding proxy's separate existing 200/user/day and 1,000/global/day caps do not limit browser map tiles/sessions. No provider key was created, no paid service was enabled and no MapTiler request was made during this audit. Geocoding flags/budgets are unchanged.

References: [Vercel environment scopes and deployment behavior](https://vercel.com/docs/environment-variables), [Expo dynamic configuration](https://docs.expo.dev/workflow/configuration/), plus the installed Expo 48 `ExpoDefinePlugin` and `ExponentConstants.web` implementation.

## 6. Verification and changed files

Passing tests cover Permissions API absent/rejected, Allow + successful position, contradictory advisory denied + successful position, timeout, true code-1 denial, geocode failure, fresh/in-flight Retry and stale callback isolation. The stored Phuket fixture remains a clearly stale visual viewport with no user position. Server HTTP tests reject stale captures, timestamp-free registrations, unattributed legacy regions and old observed regions with misleading future expiry. Wizard tests block publishing after a fresh location timeout. Primary/alternate map tests cover valid/missing keys and zero activities.

Commands: `node frontend/tests/mapConfig.test.js`, `node frontend/tests/locationAndMap.test.js`, `node frontend/tests/activityWizard.test.js`, `node frontend/tests/webMap.test.js`, `node frontend/tests/profileSelectors.test.js`, `node frontend/tests/productRefinements.test.js`, frontend TypeScript, backend build, `node backend/tests/currentRegion.test.js`, `node backend/tests/imageHardening.test.js`, `node backend/tests/activityPrivacy.test.js`, production web build and `git diff --check`. No physical Safari/WebKit engine or production activity mutation was used in tests. The production web build passed with bundle-size warnings (main entry approximately 3.05 MiB).

Changed frontend files: `app.config.js`, `package.json` (map test command), `src/api.ts`, `src/utils/locationService.ts`, `src/utils/mapConfig.ts`, `src/components/ActivityLocationPicker.tsx`, `src/screens/CreateActivityScreen.tsx`, `src/screens/MapModeScreen.tsx`, `tests/activityWizard.test.js`, `tests/locationAndMap.test.js`, new `tests/mapConfig.test.js`. Changed backend files: `src/routes/locations.ts`, `src/services/currentRegion.ts`, `tests/currentRegion.test.js`, `tests/imageHardening.test.js` (fresh-region fixture). This report is new. Expo/dependency versions and the Map design are unchanged.

## 7. iPhone follow-up

After a separately authorized coordinated frontend/backend release and fresh build containing the Vercel key:

1. Reload the actual production HTTPS origin. Confirm the primary map loads and the key-missing overlay is absent. A provider 401/403 is a distinct key/origin issue, not browser location denial.
2. Keep Safari's site permission at Allow and press Retry location. Confirm a successful fix centers on the actual device area. With geocoding unavailable, Profile may show area-found/label-unavailable; this must not say permission denied.
3. If it still fails, inspect the safe `[JOIN location] geolocation-result` fields: actual code/category plus advisory permission state. Check iOS Location Services for Safari Websites and any device restrictions. Do not send coordinates or API keys.
4. Test denied permission, then Allow + Retry; test with no saved viewport and with the existing Phuket view. The latter must be labeled previous-view-only, with no current-user dot or hosting authorization until a fresh fix succeeds.
5. With zero activities, confirm the map still pans/zooms. With location unavailable, publishing must request retry rather than host in Phuket. A selected meeting point outside the freshly acquired region must remain locked by Passport Mode.

No deployment, commit or push was performed.
