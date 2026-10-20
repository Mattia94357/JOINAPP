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
    ScrollView: 'ScrollView', ActivityIndicator: 'Spinner', Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
    StyleSheet: { create: x => x, absoluteFillObject: {} } };
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
    getCurrentJoinLocationResult: async () => pendingMapPosition || (mapDenied ? { status: 'failure', reason: 'permission-denied' } : { status: 'success', coordinate: local }),
  };
  if (name === '../api') return {
    registerCurrentRegionRequest: async () => ({ data: region }), fetchActivities: async () => [],
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
  await t.test('denied map without any valid viewport renders the neutral world map', async () => {
    mapDenied = true; storedViewport = null; let view;
    await act(async () => { view = create(React.createElement(MapScreen, { navigation: { goBack() {} }, route: { params: {} } })); });
    const map = view.root.findByType('DiscoveryMap');
    assert.equal(map.props.initialRegion.longitudeDelta, 360); assert.equal(map.props.showsUserLocation, false);
    assert.equal(map.props.activities.length, 0);
    assert.match(text(view.toJSON()), /Location unavailable/);
    assert.doesNotMatch(text(view.toJSON()), /Phuket/);
    await act(async () => view.unmount()); mapDenied = false;
  });
  await t.test('a pending Safari permission prompt never delays rendering the map', async () => {
    let finish; pendingMapPosition = new Promise(resolve => { finish = resolve; }); let view;
    await act(async () => { view = create(React.createElement(MapScreen, { navigation: { goBack() {} }, route: { params: {} } })); });
    assert.equal(view.root.findByType('DiscoveryMap').props.initialRegion.longitudeDelta, 360);
    await act(async () => { finish({ status: 'failure', reason: 'timeout' }); });
    await act(async () => view.unmount()); pendingMapPosition = null;
  });
  await t.test('a valid stored viewport is restored on a cold mount when permission is denied', async () => {
    mapDenied = true; storedViewport = JSON.stringify({ latitude: 10, longitude: 20, latitudeDelta: 2, longitudeDelta: 3 });
    delete require.cache[require.resolve('../src/screens/MapModeScreen')];
    const FreshMapScreen = require('../src/screens/MapModeScreen').default; let view;
    await act(async () => { view = create(React.createElement(FreshMapScreen, { navigation: { goBack() {} }, route: { params: {} } })); });
    const map = view.root.findByType('DiscoveryMap'); assert.equal(map.props.initialRegion.latitude, 10);
    assert.equal(map.props.initialRegion.longitudeDelta, 3); assert.equal(map.props.showsUserLocation, false);
    await act(async () => view.unmount()); storedViewport = null;
  });
  await t.test('denied map exposes an explanatory Retry action and recovers to device position', async () => {
    mapDenied = true; let view;
    await act(async () => { view = create(React.createElement(MapScreen, { navigation: { goBack() {} }, route: { params: {} } })); });
    assert.match(text(view.toJSON()), /Safari Website Settings/);
    const retry = view.root.findByProps({ accessibilityLabel: 'Retry current location' });
    mapDenied = false; await act(async () => { retry.props.onPress(); });
    const map = view.root.findByType('DiscoveryMap'); assert.equal(map.props.showsUserLocation, true);
    assert.equal(map.props.initialRegion.latitude, local.latitude);
    await act(async () => view.unmount());
  });
  await t.test('zero activities still mounts actual map with zero markers around user', async () => {
    let view; await act(async () => { view = create(React.createElement(MapScreen, { navigation: { goBack() {} }, route: { params: {} } })); });
    const map = view.root.findByType('DiscoveryMap');
    assert.equal(map.props.activities.length, 0); assert.equal(map.props.initialRegion.latitude, local.latitude);
    assert.equal(map.props.showsUserLocation, true); assert.match(text(view.toJSON()), /No activities nearby yet/);
    await act(async () => view.unmount());
  });
  await t.test('denied map uses last valid viewport without pretending to know current position', async () => {
    mapDenied = true; let view;
    await act(async () => { view = create(React.createElement(MapScreen, { navigation: { goBack() {} }, route: { params: {} } })); });
    const map = view.root.findByType('DiscoveryMap'); assert.equal(map.props.showsUserLocation, false); assert.equal(map.props.activities.length, 0);
    assert.equal(map.props.initialRegion.latitude, local.latitude);
    await act(async () => view.unmount());
  });
});
