# iPhone Safari location and blank Map investigation

## Location permission

The web path calls the top-level browser's `navigator.geolocation.getCurrentPosition`; Safari does not use the native WebView or Expo permission APIs here. A browser permission-denied result is different from position-unavailable, timeout or a successful device fix. HTTPS is required (localhost is the development exception). Retry forces another browser call; it does not reuse a denial or a cached successful fix. Numeric standard geolocation error codes are now used directly, including when error objects do not expose named constants.

A website cannot override an iOS/Safari denial. Possible causes include a denied per-site permission, Safari Websites being restricted in Location Services, device restrictions, or embedding/permissions policy. No physical iPhone, Safari device logs or connected browser session was available, so the exact cause of the reported phone's denial is **not confirmed**. Do not attribute it to the map provider: browser positioning happens separately from maps and reverse geocoding.

The Map now shows an explicit explanatory denial state and visible Retry location action. Profile and activity location selection share the same explanatory message. Successful browser coordinates remain the only source for current user location; typed activity locations and the new world viewport never become a device position or allowed hosting region.

For a physical iPhone check: open the actual HTTPS JOIN origin in Safari, inspect Page Menu → Website Settings → Location, choose Ask/Allow, and check Settings → Privacy & Security → Location Services → Safari Websites. Then press Retry location. If device restrictions prevent changes, resolve those at device level. See [Apple's Safari website permission guidance](https://support.apple.com/guide/iphone/browse-the-web-privately-iphb01fc3c85/ios) and [Location Services guidance](https://support.apple.com/en-us/102515). Menu details vary by iOS version.

## Confirmed blank-map bugs

1. **Location gated map mounting.** `mapRegion` started as null. Initialization waited for the geolocation request and left it null when permission failed and neither an in-memory nor saved viewport existed. The map component therefore never mounted, regardless of a valid provider or zero activities.
2. **Raster fallback crashed with no selected activity.** `safeJson(selectedActivityId)` called `JSON.stringify(undefined).replace(...)`. Zero activities means no selected ID, so rendering the fallback threw before its iframe could mount. This was reproduced by testing the actual web component with a missing MapTiler key and zero activities. Serialization now produces JSON null for absent values.

The local Expo configuration was inspected without printing keys: no public MapTiler key is present locally, and the configured default style is `streets-v4-dark`. The installed MapTiler client recognizes that style family. Deployed environment/key permissions, HTTP responses and real iPhone WebGL support were **not inspected**; a production key/style failure must be distinguished using the new diagnostics rather than assumed. Valid style IDs now resolve explicitly to HTTPS MapTiler style URLs; invalid style values use the existing default with a diagnostic. See [MapTiler style configuration](https://docs.maptiler.com/sdk-js/examples/change-map-styles/).

## Rendering changes

- Mount the map immediately using a neutral world viewport (0/0, world-scale zoom). This is a viewing position, with no user marker and no geographic claim about the user.
- Restore a valid saved viewport without waiting for permission. A successful device fix takes precedence over late storage reads and centers the map. Denial keeps the last valid viewport or the world map.
- Zero activities sends an empty marker collection. Feed errors/loading and location failures are independent of the map surface. Existing activity privacy filtering is preserved.
- Give the web screen explicit measured viewport height, plus a full-size positioned map frame. Do not rely exclusively on `100dvh` support or initialize WebGL into a zero-size container.
- Observe container and visual viewport resizing, including Safari toolbar/orientation and page visibility restoration. Resize the SDK map without reconstructing it on every location change. Raster maps invalidate their Leaflet size on resize.
- Catch SDK constructor/WebGL failures, initial provider/style errors and a 15-second initial style-load timeout. Use the existing interactive raster provider if MapTiler cannot initialize. Missing/placeholder keys also choose that existing path, with a small explanatory overlay.
- Resynchronize iframe activity data/user-dot state after loading so messages sent during CDN startup are not lost. Removing location permission hides the user dot. Report iframe/dependency/tile errors without replacing the map container with a black screen.

## Safe diagnostics

`[JOIN map]` events include configuration issues, container width/height, readiness, initialization failure and provider/style errors. Fields are explicitly limited to dimensions, provider, short reason codes and HTTP status. Raw SDK errors, request URLs, API keys and precise coordinates are not logged by these diagnostics. The raster path emits source-checked iframe lifecycle/error messages; activity selection still validates known activity IDs.

No provider keys, live settings, dependency versions or backend code were changed. Existing MapTiler/Esri/CDN traffic still depends on network access, content blockers, key restrictions and account quotas. No live map/geocoding provider requests were made in the tests, and no new provider was added.

## Tests and limits

- `node frontend/tests/locationAndMap.test.js`: granted/denied/unavailable/timeout/unsupported/HTTPS states, repeat browser requests after denial, world map with zero activities, pending permission, valid saved viewport on a cold mount, denial explanation/retry and successful recentering.
- `node frontend/tests/webMap.test.js`: actual `.web.tsx` React entrypoint with mocked SDK/DOM boundaries, zero markers, valid/missing/placeholder configuration, resolved style URL, world/local zoom, zero-size initialization and resizing, no SDK reconstruction on location updates, raster iframe startup/data synchronization, WebGL/constructor/provider failures and diagnostic redaction.
- `node frontend/tests/profileSelectors.test.js` and `node frontend/tests/productRefinements.test.js`: existing location/Profile behavior and map source regressions.
- Results: all 10 location/map subtests, all 7 direct web-map subtests, all 11 existing Profile subtests and product refinement checks passed. Frontend TypeScript and `git diff --check` passed. Production web export passed with Webpack bundle-size warnings (main entry approximately 3.05 MiB).

These are component/integration tests, not physical Safari or WebKit engine verification. Real iPhone checks remain required: permission settings and prompts, Safari toolbar/orientation layout, actual WebGL/tiles/CDN access, provider key origin restrictions, pinch/pan, and denial → settings change → Retry. There was no deployment, commit, push or Expo upgrade.
