# Map location/error UX audit — 2026-10-20

## Findings and configuration action

**MapTiler:** A read-only `vercel env ls production --cwd frontend` audit of the linked Vercel project `frontend` returned only `EXPO_PUBLIC_API_URL`. **`EXPO_PUBLIC_MAPTILER_API_KEY` is missing from that project's Production environment.** No environment values were printed or changed. Supply the intended public browser key under that exact name in Vercel → frontend → Settings → Environment Variables → Production. A subsequent authorized production build/deployment is necessary; changing an environment variable cannot modify an existing bundle. No deployment was performed.

This app uses Expo 48 with Webpack, not Vite. A `VITE_` prefix would not fix it. The existing `app.config.js` → Expo manifest extras → `getMapTilerConfig()` bridge is required for this Expo version and passes the installed Webpack injection test. The default style is `streets-v4-dark`; `EXPO_PUBLIC_MAPTILER_MAP_STYLE` is optional. No key was provided, so its validity, domain restrictions, and live style/tile authorization cannot be verified. Those checks remain necessary after supplying the key. The local build does not resolve the missing production key.

**Location:** The exact reason for the physical iPhone's failure is not established without its `getCurrentPosition` result. Website permission Allow does not, by itself, identify the result of a device location request. The confirmed Map UX problems were passive geolocation acquisition on mount, another acquisition through the activity fetch, and persistent error/instruction panels. These have been removed from the Map flow. The shared browser service already uses `navigator.geolocation.getCurrentPosition` and classifies numeric errors independently: 1 denied, 2 unavailable, 3 timeout. Permission inspection is advisory. Actual request results remain authoritative, including when the Permissions API is unsupported or disagrees. Existing safe diagnostics report error code/category and permission state without coordinates. No claim is made that JavaScript can reopen a denied native prompt.

**Previous map position:** A saved/session viewport may still be restored as a visual position, including an old Phuket view. The default is a neutral world view. Neither saved viewport nor activity coordinates establish current user location, produce a current-location dot, or register a hosting region. Only a successful actual device fix is passed to the existing current-region registration flow, with its capture timestamp. Typed locations, profiles, Passport Mode, and hosting rules were not changed.

## Resulting behavior

- First Map entry opens a compact dark/gold location modal. Allow location explicitly requests a fresh fix; Not now dismisses it without a request. Dismissal is remembered for the current app session, including Map remounts.
- Recenter requests immediately when permission is known granted. Otherwise it opens the modal. Denied state offers Show instructions and Continue without location. Show instructions does not request location; I've updated settings explicitly retries.
- Success closes the modal, clears the location issue, centers the actual fix, shows its dot, registers the actual region, and loads activities without a second geolocation request.
- Timeout, unavailable, unsupported, and insecure-context states have appropriate modal copy. Continue leaves map browsing, search, and categories accessible without permanent location instructions or a fake current position.
- The map mounts with zero activities and unavailable location. Existing alternate Leaflet rendering remains. Technical MapTiler messages are hidden from normal users; provider/configuration diagnostics run only in development. A total map failure can show a brief generic connection message.
- Activity states are explicit: idle/loading do not claim an empty result; successful empty results show No activities nearby yet; failure shows the compact Couldn't load activities. Try again. control. The location modal suppresses both notices. Failure and empty success cannot appear together.

## Files changed

- `frontend/src/components/MapLocationModal.tsx` — new modal.
- `frontend/src/utils/mapLocationPermission.ts` — bounded advisory permission inspection; never requests location.
- `frontend/src/screens/MapModeScreen.tsx` — user-action location flow, dismissal, explicit feed states, removed persistent panels.
- `frontend/src/api.ts` — optional Map-only opt-out of the existing automatic location acquisition in `fetchActivities`; other callers retain their behavior.
- `frontend/src/components/MapModeMap.web.tsx` — silent fallback and temporary generic total-map failure message.
- `frontend/src/utils/mapConfig.ts`, `frontend/src/utils/webMap.ts` — development-only technical map diagnostics.
- `frontend/tests/locationAndMap.test.js`, `frontend/tests/webMap.test.js`, `frontend/tests/productRefinements.test.js`, `frontend/tests/productionCleanup.test.js` — updated behavior/regression assertions.
- This report.

## Validation

Passed:

- `node frontend/tests/locationAndMap.test.js` — 15 subtests, including explicit acquisition, advisory permission races, denial/settings retry, dismissal/remount, timeout/unavailable, stale viewport, and feed-error recovery.
- `node frontend/tests/webMap.test.js` — 8 subtests, including valid primary provider, zero markers, fallback, container/resize and load failures, and silent production diagnostics/UI.
- `node frontend/tests/mapConfig.test.js` — 2 tests, including the installed Expo/Webpack manifest injection path.
- `node frontend/tests/productRefinements.test.js`.
- `node frontend/tests/productionCleanup.test.js`.
- `node frontend/tests/activityWizard.test.js` — 18 subtests.
- `node frontend/tests/profileSelectors.test.js` — 11 subtests.
- `npx tsc --noEmit -p frontend/tsconfig.json`.
- `npm run build --workspace frontend` — successful production web export; Webpack bundle-size warnings remain.
- `git diff --check`.

Component tests use mocks; these are not physical iPhone, desktop visual, or real provider-network tests. On iPhone Safari and desktop, verify first visit/Allow/Not now, true denial, refresh after denial, recenter after denial, settings-confirm retry, disabled Location Services, timeout, actual centering, and continued browsing without location. Verify API failure/recovery versus successful empty results. After separately authorizing configuration and deployment, verify primary MapTiler tiles with the production domain restrictions and silent Leaflet fallback when the provider is unavailable.

No Expo/dependency upgrade, backend change, deployment, commit, or push. Main navigation, Explore, Create Activity, Messages, Profile, authentication, activity cards, and existing filter controls were not edited. This scope statement is supported by the file diff; it is not a claim of full manual regression coverage.
