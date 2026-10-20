const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const originalLoad = Module._load;
global.__DEV__ = false;
global.window = { isSecureContext: true };
const local = { latitude: -31.95, longitude: 115.86 };
const region = { ...local, radiusKm: 50, expiresAt: new Date(Date.now() + 1800000).toISOString(), label: 'Perth, Western Australia, Australia' };
let permissionObservation = null;
let mapPermission = 'unknown'; let mapFeedFailure = false; let mapFeedCalls = []; let mapGeoCalls = 0; let mapFailureReason = 'permission-denied';
let reverseFailure = false;
let pendingMapPosition = null;
let browserPositionRequests = 0;
let position = 'granted'; let requests = []; let storedViewport = null; let mapDenied = false;
Object.defineProperty(global, 'navigator', { configurable: true, value: { geolocation: { getCurrentPosition(success, failure, options) {
  browserPositionRequests++;
  assert.equal(options.enableHighAccuracy, false);
  if (position === 'granted') success({ coords: { ...local, accuracy: 40 } });
  else failure({ code: position === 'denied' ? 1 : position === 'timeout' ? 3 : 2 });
} } } });
Module._load = function(name, parent, main) {
  if (name === 'react-native') return { View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', Image: 'Image', SafeAreaView: 'SafeAreaView',
    ScrollView: 'ScrollView', Modal: props => props.visible ? React.createElement('Modal', props, props.children) : null, ActivityIndicator: 'Spinner', Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
    StyleSheet: { create: x => x, absoluteFillObject: {} } };
  if (name === '../utils/mapLocationPermission') return { inspectMapPermission: async () => permissionObservation || mapPermission };
  if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
  if (name === '@expo/vector-icons') return { Ionicons: () => null };
  if (name === 'expo-location') return { reverseGeocodeAsync: () => { throw new Error('Expo reverse geocoder must not run on web'); } };
  if (name === '@react-native-async-storage/async-storage') return { getItem: async () => storedViewport, setItem: async (_key, value) => { storedViewport = value; } };
  if (name === '../utils/safeError' || name === './safeError') return { reportFrontendError() {} };
  if (name === '../utils/mapConfig') return { getMapTilerConfig: () => ({}) };
  if (name === '../context/AuthContext') return { useAuth: () => ({ token: 'token' }) };
  if (name === '../components/AvatarBadge') return { __esModule: true, default: () => null };
  if (name === '../components/MapModeMap') return { __esModule: true, default: props => React.createElement('DiscoveryMap', props) };
  if (name === './InteractiveLocationMap') return { __esModule: true, default: props => React.createElement('LocationMap', props) };
  if (name === '../utils/locationService' && parent?.filename.includes('MapModeScreen')) return {
    ...require('../src/utils/locationService'),
    getCurrentJoinLocationResult: async () => { mapGeoCalls++; return pendingMapPosition || (mapDenied ? { status: 'failure', reason: mapFailureReason } : { status: 'success', coordinate: local, capturedAt: Date.now() }); },
  };
  if (name === '../api') return {
    registerCurrentRegionRequest: async () => { if (reverseFailure) throw { response: { status: 403, data: { message: 'Place provider unavailable' } } }; return { data: region }; }, fetchActivities: async (...args) => { mapFeedCalls.push(args); if (mapFeedFailure) throw Error('offline'); return []; },
    searchPlacesRequest: async q => { requests.push(q); return { data: [
      { ...local, id: 'local', name: 'Cafe', label: 'Cafe, Northbridge, Perth' },
      { latitude: 7.88, longitude: 98.39, id: 'remote', name: 'Remote', label: 'Remote city' },
    ] }; },
  };
  return originalLoad.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.ts'] = compile; require.extensions['.tsx'] = compile;
const service = require('../src/utils/locationService');
const Picker = require('../src/components/ActivityLocationPicker').default;
const MapScreen = require('../src/screens/MapModeScreen').default;
const text = node => typeof node === 'string' ? node : (Array.isArray(node) ? node : node?.children || []).map(text).join('');

test('browser location, autocomplete and empty map regressions', async t => {
  t.after(() => { Module._load = originalLoad; });
  await t.test('granted uses browser coordinates and friendly proxy label without Expo or stored profile fallback', async () => {
    const result = await service.getCurrentJoinPlaceResult({ token: 'token', forceRefresh: true });
    assert.equal(result.status, 'success'); assert.equal(result.place, region.label); assert.deepEqual(result.coordinate, local);
  });
  await t.test('denied, unavailable, insecure and recovered granted states remain distinct', async () => {
    const beforeRetry = browserPositionRequests;
    position = 'denied'; assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).reason, 'permission-denied');
    position = 'unavailable'; assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).reason, 'position-unavailable');
    position = 'timeout'; assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).reason, 'timeout');
    const supported = navigator.geolocation; delete navigator.geolocation;
    assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).reason, 'unsupported'); navigator.geolocation = supported;
    window.isSecureContext = false; assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).reason, 'insecure-context');
    window.isSecureContext = true; position = 'granted';
    assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).status, 'success', 'a denied browser session may be retried after permission changes');
    assert.ok(browserPositionRequests > beforeRetry + 1, 'retry invokes the browser API again');
  });
  await t.test('Safari Permissions API is advisory, including missing, unsupported, denied and Allow results', async () => {
    const originalInfo = console.info; const diagnostics = []; console.info = (...args) => diagnostics.push(args);
    try {
      position = 'granted'; delete navigator.permissions;
      assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).status, 'success');
      navigator.permissions = { query: async () => { throw Error('Unsupported Safari descriptor'); } };
      assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).status, 'success');
      navigator.permissions = { query: async () => ({ state: 'granted' }) };
      assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).status, 'success');
      navigator.permissions = { query: async () => ({ state: 'denied' }) };
      assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).status, 'success', 'actual request success overrides advisory denied');
      navigator.permissions = { query: async () => ({ state: 'granted' }) };
      position = 'timeout'; assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).reason, 'timeout');
      position = 'denied'; assert.equal((await service.getCurrentJoinLocationResult({ forceRefresh: true })).reason, 'permission-denied', 'true error code 1 remains denied even when permission API says Allow');
      assert.ok(diagnostics.some(([, data]) => data.errorCode === 1 && data.category === 'permission-denied' && data.permissionState === 'granted'));
      assert.ok(diagnostics.some(([, data]) => data.errorCode === 3 && data.category === 'timeout'));
      assert.doesNotMatch(JSON.stringify(diagnostics), /-31.95|115.86/);
    } finally { console.info = originalInfo; delete navigator.permissions; position = 'granted'; }
  });
  await t.test('Retry bypasses a cached/in-flight attempt and an older denial cannot clear the fresh fix', async () => {
    const original = navigator.geolocation.getCurrentPosition; const attempts = [];
    navigator.geolocation.getCurrentPosition = (success, failure, options) => { assert.equal(options.maximumAge, 0); attempts.push({ success, failure }); };
    try {
      const old = service.getCurrentJoinLocationResult({ forceRefresh: true });
      const fresh = service.getCurrentJoinLocationResult({ forceRefresh: true });
      assert.equal(attempts.length, 2);
      attempts[1].success({ coords: { ...local, accuracy: 40 }, timestamp: Date.now() }); assert.equal((await fresh).status, 'success');
      attempts[0].failure({ code: 1 }); assert.equal((await old).reason, 'permission-denied');
      assert.equal((await service.getCurrentJoinLocationResult()).status, 'success'); assert.equal(attempts.length, 2);
    } finally { navigator.geolocation.getCurrentPosition = original; }
  });
  await t.test('provider failure cannot turn a successful browser fix into permission denied', async () => {
    reverseFailure = true;
    try { const result = await service.getCurrentJoinPlaceResult({ token: 'token', forceRefresh: true });
      assert.equal(result.status, 'success'); assert.equal(result.reason, undefined); assert.equal(result.place, undefined);
    } finally { reverseFailure = false; }
  });
  await t.test('minimum length, 450ms debounce, nearby filtering, selected marker, map clicks and Passport rejection', async () => {
    requests = []; let view;
    function Wrapper() {
      const [value, setValue] = React.useState(''); const [selected, setSelected] = React.useState();
      return React.createElement(Picker, { token: 'token', value, selected,
        onChangeText: value => { setValue(value); setSelected(undefined); }, onSelect: place => { setValue(place.label); setSelected(place); } });
    }
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
      await act(async () => { view = create(React.createElement(Wrapper)); });
      const input = () => view.root.findByType('Input');
      await act(async () => { input().props.onChangeText('ca'); });
      await act(async () => { t.mock.timers.tick(1000); }); assert.equal(requests.length, 0);
      await act(async () => { input().props.onChangeText('caf'); });
      await act(async () => { t.mock.timers.tick(300); }); assert.equal(requests.length, 0);
      await act(async () => { input().props.onChangeText('cafe'); });
      await act(async () => { t.mock.timers.tick(449); }); assert.equal(requests.length, 0);
      await act(async () => { t.mock.timers.tick(1); }); assert.deepEqual(requests, ['cafe']);
      assert.doesNotMatch(text(view.toJSON()), /Remote city/);
      await act(async () => { view.root.findByProps({ accessibilityLabel: 'Select Cafe' }).props.onPress(); });
      assert.deepEqual(view.root.findByType('LocationMap').props.coordinate.latitude, local.latitude);
      assert.equal(view.root.findByType('LocationMap').props.showMarker, true);
      await act(async () => { view.root.findByType('LocationMap').props.onSelectCoordinate({ latitude: 7.88, longitude: 98.39 }); });
      assert.match(text(view.toJSON()), /Passport Mode is required to host activities in another location/);
      assert.equal(view.root.findByType('LocationMap').props.coordinate.latitude, local.latitude);
      await act(async () => { view.root.findByType('LocationMap').props.onSelectCoordinate({ latitude: -31.96, longitude: 115.87 }); });
      assert.equal(view.root.findByType('LocationMap').props.coordinate.latitude, -31.96);
      await act(async () => { input().props.onChangeText('cafe'); });
      await act(async () => { t.mock.timers.tick(450); }); assert.equal(requests.length, 1, 'short-lived cache prevents a duplicate provider request');
    } finally { if (view) await act(async () => view.unmount()); t.mock.timers.reset(); }
  });
  await t.test('client request cap stops uncached search traffic', async () => {
    const { cachedPlaceSearch } = require('../src/utils/currentRegion');
    let calls = 0; let blocked = false;
    for (let n = 0; n < 15; n++) {
      try { await cachedPlaceSearch(`unique-${n}`, region, 'cap-test-token', async () => { calls++; return []; }); }
      catch (error) { assert.match(error.message, /Too many place searches/); blocked = true; break; }
    }
    assert.equal(blocked, true); assert.ok(calls <= 12);
  });
  const freshMap = async () => {
    delete require.cache[require.resolve('../src/screens/MapModeScreen')];
    const Screen = require('../src/screens/MapModeScreen').default; let view;
    await act(async () => { view = create(React.createElement(Screen, { navigation: { goBack() {} }, route: { params: {} } })); });
    return { view, Screen };
  };
  const pressMap = async (view, label) => {
    const button = view.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label);
    assert.ok(button, label); await act(async () => { button.props.onPress(); });
  };
  const resetMap = () => { permissionObservation = null; mapPermission = 'unknown'; mapDenied = false; mapFeedFailure = false; mapFeedCalls = []; mapGeoCalls = 0; storedViewport = null; mapFailureReason = 'permission-denied'; };
  await t.test('first visit prompts without requesting location; Not now leaves a clean map and does not nag on rerender/remount', async () => {
    resetMap(); const { view, Screen } = await freshMap();
    assert.equal(mapGeoCalls, 0); assert.equal(mapFeedCalls.length, 0); assert.match(text(view.toJSON()), /Location needed/);
    assert.equal(view.root.findByType('DiscoveryMap').props.activities.length, 0);
    await pressMap(view, 'Not now'); assert.equal(view.root.findAllByType('Modal').length, 0);
    assert.doesNotMatch(text(view.toJSON()), /Location unavailable|Previous map view|Safari|No activities nearby|Couldn.t load/);
    await act(async () => view.root.findByType('Input').props.onChangeText('coffee'));
    assert.equal(view.root.findAllByType('Modal').length, 0); await act(async () => view.unmount());
    let remount; await act(async () => { remount = create(React.createElement(Screen, { navigation: { goBack() {} }, route: { params: {} } })); });
    assert.equal(remount.root.findAllByType('Modal').length, 0); assert.equal(mapGeoCalls, 0);
    await pressMap(remount, 'Recenter map on current location'); assert.match(text(remount.toJSON()), /Location needed/);
    await act(async () => remount.unmount());
  });
  await t.test('Allow is a user action, closes popup, centers actual position and fetches once without another location request', async () => {
    resetMap(); const { view } = await freshMap(); await pressMap(view, 'Allow location');
    assert.equal(mapGeoCalls, 1); assert.equal(view.root.findAllByType('Modal').length, 0);
    const map = view.root.findByType('DiscoveryMap'); assert.equal(map.props.initialRegion.latitude, local.latitude); assert.equal(map.props.showsUserLocation, true);
    assert.equal(mapFeedCalls.length, 1); assert.equal(mapFeedCalls[0][1].requestLocation, false);
    assert.match(text(view.toJSON()), /No activities nearby yet/); assert.doesNotMatch(text(view.toJSON()), /Couldn.t load|Location unavailable/);
    await pressMap(view, 'Recenter map on current location'); assert.equal(mapGeoCalls, 2);
    await act(async () => view.unmount());
  });
  await t.test('a late advisory denied state cannot override a successful actual request', async () => {
    resetMap(); let observed; permissionObservation = new Promise(resolve => { observed = resolve; });
    const { view } = await freshMap(); await pressMap(view, 'Allow location');
    await act(async () => observed('denied'));
    await pressMap(view, 'Recenter map on current location');
    assert.equal(mapGeoCalls, 2); assert.equal(view.root.findAllByType('Modal').length, 0); await act(async () => view.unmount());
  });
  await t.test('denied permission shows instructions, not repeated requests; explicit settings confirmation can recover', async () => {
    resetMap(); mapPermission = 'denied'; mapDenied = true; const { view } = await freshMap();
    assert.match(text(view.toJSON()), /Location access is off/); assert.equal(mapGeoCalls, 0);
    await pressMap(view, 'Continue without location');
    assert.doesNotMatch(text(view.toJSON()), /Location access is off|Safari|Previous map view/);
    await pressMap(view, 'Recenter map on current location'); assert.equal(mapGeoCalls, 0);
    await pressMap(view, 'Show instructions'); assert.match(text(view.toJSON()), /Website Settings/); assert.equal(mapGeoCalls, 0);
    mapDenied = false; await pressMap(view, "I've updated settings");
    assert.equal(mapGeoCalls, 1); assert.equal(view.root.findAllByType('Modal').length, 0);
    assert.equal(view.root.findByType('DiscoveryMap').props.showsUserLocation, true); await act(async () => view.unmount());
  });
  await t.test('unsupported Permissions API still prompts normally; actual denial is remembered on the next recenter', async () => {
    resetMap(); mapDenied = true; const { view } = await freshMap(); await pressMap(view, 'Allow location');
    assert.equal(mapGeoCalls, 1); assert.match(text(view.toJSON()), /Location access is off/);
    await pressMap(view, 'Continue without location'); await pressMap(view, 'Recenter map on current location');
    assert.equal(mapGeoCalls, 1); assert.match(text(view.toJSON()), /Location access is off/); await act(async () => view.unmount());
  });
  await t.test('timeout, disabled/unavailable services, unsupported browser and insecure context use dismissible popups', async () => {
    for (const reason of ['timeout', 'position-unavailable', 'unsupported', 'insecure-context']) {
      resetMap(); mapDenied = true; mapFailureReason = reason; const { view } = await freshMap(); await pressMap(view, 'Allow location');
      assert.equal(view.root.findAllByType('Modal').length, 1); assert.equal(view.root.findAllByType('DiscoveryMap').length, 1);
      assert.doesNotMatch(text(view.toJSON()), /Location access is off/);
      await pressMap(view, 'Continue without location'); assert.equal(view.root.findAllByType('Modal').length, 0);
      assert.doesNotMatch(text(view.toJSON()), /Location unavailable|Location timed out|HTTPS|Location Services/); await act(async () => view.unmount());
    }
  });
  await t.test('saved Phuket view is visual only and unobstructed after declining location', async () => {
    resetMap(); storedViewport = JSON.stringify({ latitude: 7.88, longitude: 98.39, latitudeDelta: 2, longitudeDelta: 3 });
    const { view } = await freshMap(); await pressMap(view, 'Not now');
    const map = view.root.findByType('DiscoveryMap'); assert.equal(map.props.initialRegion.latitude, 7.88); assert.equal(map.props.userCoordinate, null);
    assert.doesNotMatch(text(view.toJSON()), /Previous map view|Location unavailable/); assert.equal(mapGeoCalls, 0); await act(async () => view.unmount());
  });
  await t.test('activity error and successful empty response are mutually exclusive and modal has priority', async () => {
    resetMap(); mapFeedFailure = true; const { view } = await freshMap(); await pressMap(view, 'Allow location');
    assert.match(text(view.toJSON()), /Couldn't load activities. Try again./); assert.doesNotMatch(text(view.toJSON()), /No activities nearby/);
    mapDenied = true; await pressMap(view, 'Recenter map on current location');
    assert.match(text(view.toJSON()), /Location access is off/); assert.doesNotMatch(text(view.toJSON()), /Couldn't load activities/);
    await pressMap(view, 'Continue without location'); mapDenied = false; mapFeedFailure = false;
    await pressMap(view, 'Retry loading map activities');
    assert.match(text(view.toJSON()), /No activities nearby yet/); assert.doesNotMatch(text(view.toJSON()), /Couldn't load activities/); await act(async () => view.unmount());
  });
});
