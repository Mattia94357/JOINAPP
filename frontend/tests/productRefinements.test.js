const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const card = source('src/components/ActivityCard.tsx');
const map = source('src/screens/MapModeScreen.tsx');
const profile = source('src/screens/ProfileScreen.tsx');
const create = source('src/screens/CreateActivityScreen.tsx');
const selectors = source('src/components/ActivityDateTimeSelectors.tsx');
const assets = source('src/utils/activityAssets.ts');
const locationService = source('src/utils/locationService.ts');

assert.match(card, /60\.632 \+ 56 \+ 8/, 'decision controls preserve size with exactly 8px between them');
assert.match(card, /accessibilityLabel="About the activity"[\s\S]*?onPress=\{onPress\}|onPress=\{onPress\}[\s\S]*?accessibilityLabel="About the activity"/);
assert.ok((card.match(/onPress=\{onPress\}/g) || []).length >= 2, 'top/details interactions share the navigation handler');

assert.match(map, /getCurrentJoinLocationResult/);
assert.doesNotMatch(map, /Phuket|GLOBAL_FALLBACK_REGION|firstMappedActivity/);
assert.match(map, /previousSessionViewport/);
assert.match(map, /setMapRegion\(null\)/);
assert.match(map, /onViewportChange=\{rememberMapViewport\}/);
assert.equal((map.match(/setRecenterRequest/g) || []).length, 2, 'recenter occurs only through explicit current-location handling');
assert.match(map, /locationResult\.status === 'success'[\s\S]*?setMapRegion\(region\)/, 'successful location centers the initial map');
assert.match(locationService, /reason: 'permission-denied'/, 'denied permissions return a safe result');
assert.match(locationService, /\? 'position-unavailable'/, 'unavailable positions return a safe result');

assert.doesNotMatch(profile, /Beta profile|Visible on public profile|Hidden from public profile|profileLocation/);
assert.match(profile, />Profile details</);
assert.match(profile, />Edit profile</);
assert.match(profile, /editingProfile \? \(/);
assert.match(profile, /resetProfileDrafts\(\); setEditingProfile\(false\)/);
assert.match(profile, /getCurrentJoinPlaceResult/);
assert.match(profile, /Passport Mode/);
assert.match(profile, /require an upgrade/);

assert.match(create, /ActivityDateSelector/);
assert.match(create, /ActivityTimeSelector/);
assert.doesNotMatch(create, /Paste image URL for now/);
assert.doesNotMatch(create, /gallery image URL|More photos/);
assert.match(create, /coverImageData: coverImage\?\.data/);
assert.match(create, /resolveActivityImage\(\{ category \}\)/);
assert.match(create, /setCoverImage\(undefined\)/);
assert.match(selectors, /length: 48/);
assert.match(selectors, /index % 2 \? 30 : 0/);
assert.match(assets, /uploadedImage\?\.trim\(\) \|\| getCategoryActivityImage/);
assert.doesNotMatch(assets, /reduce\(|% defaultImages/);

console.log('Product refinement regression tests passed.');
