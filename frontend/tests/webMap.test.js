const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.__DEV__ = true;
const originalLoad = Module._load;
const originalInfo = console.info;
const diagnostics = [];
console.info = (...args) => diagnostics.push(args);
let size = { width: 390, height: 760 }; let instances = []; let observers = []; let failConstructor = false;
const messages = []; const listeners = new Map();
global.window = { addEventListener: (event, handler) => listeners.set(event, handler), removeEventListener: event => listeners.delete(event) };
global.ResizeObserver = class { constructor(handler) { this.handler = handler; observers.push(this); } observe() {} disconnect() {} };
global.document = { createElement: () => ({ classList: { toggle() {} }, style: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }) };
class MapMock {
  constructor(options) { if (failConstructor) throw Error('private-key-provider-url'); this.options = options; this.events = {}; this.resizes = 0; this.sources = {}; instances.push(this); }
  on(event, ...args) { this.events[event] = args.at(-1); }
  addSource(id, source) { this.sources[id] = { ...source, setData(data) { this.data = data; } }; }
  addLayer() {} getSource(id) { return this.sources[id]; }
  getZoom() { return this.options.zoom; } getCanvas() { return { style: {}, addEventListener() {} }; }
  getCenter() { return { lat: 0, lng: 0 }; } getBounds() { return { getNorth: () => 85, getSouth: () => -85, getEast: () => 180, getWest: () => -180 }; }
  resize() { this.resizes++; } easeTo(options) { this.lastMove = options; } remove() { this.removed = true; }
}
class MarkerMock { setLngLat() { return this; } addTo() { return this; } remove() {} }
Module._load = function(name, parent, main) {
  if (name.endsWith('.css')) return {};
  if (name === '@maptiler/sdk') return { Map: MapMock, Marker: MarkerMock, Language: { ENGLISH: 'en' } };
  return originalLoad.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.ts'] = compile; require.extensions['.tsx'] = compile;
const { WORLD_MAP_VIEWPORT, resolveWebMapConfig, viewportZoom } = require('../src/utils/webMap');
const WebMap = require('../src/components/MapModeMap.web').default;
const frameWindow = { postMessage: message => messages.push(message) };
const node = { getBoundingClientRect: () => size, contentWindow: frameWindow };
const base = { initialRegion: WORLD_MAP_VIEWPORT, showsUserLocation: false, activities: [], onSelectActivity() {}, mapStyleId: 'streets-v4-dark', mapTilerApiKey: 'test-private-key' };
const text = node => typeof node === 'string' ? node : (Array.isArray(node) ? node : node?.children || []).map(text).join('');
async function mount(extra = {}) { let view; await act(async () => { view = create(React.createElement(WebMap, { ...base, ...extra }), { createNodeMock: () => node }); }); return view; }
async function unmount(view) { await act(async () => view.unmount()); }

test('web/Safari map component paths', async t => {
  t.beforeEach(() => { instances = []; observers = []; diagnostics.length = 0; messages.length = 0; size = { width: 390, height: 760 }; failConstructor = false; });
  t.after(() => { Module._load = originalLoad; console.info = originalInfo; });
  await t.test('valid key and world viewport initialize an actual map and an empty marker source', async () => {
    const view = await mount(); const map = instances[0];
    assert.equal(instances.length, 1); assert.ok(map.options.zoom < 2);
    assert.equal(map.options.style, 'https://api.maptiler.com/maps/streets-v4-dark/style.json');
    await act(async () => map.events.load());
    assert.equal(map.sources['join-activities'].data.features.length, 0);
    assert.equal(view.root.findAllByType('iframe').length, 0);
    assert.ok(diagnostics.some(([event, data]) => event.includes('container-size') && data.width === 390 && data.height === 760));
    await unmount(view);
  });
  await t.test('zero-size Safari layout waits for real dimensions and resizes without reconstructing the map', async () => {
    size = { width: 0, height: 0 }; const view = await mount(); assert.equal(instances.length, 0);
    size = { width: 390, height: 760 }; await act(async () => observers[0].handler()); assert.equal(instances.length, 1);
    await act(async () => observers[0].handler()); assert.equal(instances.length, 1); assert.ok(instances[0].resizes > 0);
    await unmount(view);
  });
  await t.test('granted location changes the viewport without remounting the SDK', async () => {
    const view = await mount();
    await act(async () => view.update(React.createElement(WebMap, { ...base, initialRegion: { latitude: -31.95, longitude: 115.86, latitudeDelta: 0.06, longitudeDelta: 0.06 }, showsUserLocation: true, userCoordinate: { latitude: -31.95, longitude: 115.86 } })));
    assert.equal(instances.length, 1); assert.deepEqual(instances[0].lastMove.center, [115.86, -31.95]);
    assert.ok(instances[0].lastMove.zoom > 10); await unmount(view);
  });
  await t.test('missing key uses the existing interactive raster iframe even with no position or activities', async () => {
    const view = await mount({ mapTilerApiKey: undefined }); const frame = view.root.findByType('iframe');
    assert.equal(instances.length, 0); assert.match(frame.props.srcDoc, /setView\(\[0,0\],1\)/);
    assert.match(frame.props.srcDoc, /let activities=\[\]/); assert.match(frame.props.srcDoc, /invalidateSize/);
    assert.doesNotMatch(text(view.toJSON()), /MapTiler|key missing|alternate map/);
    await act(async () => frame.props.onLoad()); assert.ok(messages.some(m => m.type === 'join-map-activities-update' && m.activities.length === 0));
    assert.ok(messages.some(m => m.type === 'join-map-user-location' && m.visible === false));
    await act(async () => listeners.get('message')({ source: frameWindow, data: { type: 'join-map-tile-error' } }));
    assert.match(text(view.toJSON()), /Couldn.t load the map/); await unmount(view);
  });
  await t.test('constructor/WebGL failure selects the raster path without crashing the screen', async () => {
    failConstructor = true; const view = await mount();
    assert.equal(view.root.findAllByType('iframe').length, 1); assert.doesNotMatch(text(view.toJSON()), /MapTiler|Showing alternate map/);
    assert.ok(diagnostics.some(([event]) => event.includes('initialization-failed'))); await unmount(view);
  });
  await t.test('provider/style errors fall back and diagnostics omit keys, URLs and coordinates', async () => {
    const view = await mount();
    await act(async () => instances[0].events.error({ error: { status: 401, message: 'https://provider.test/?key=test-private-key&lat=-31.95' } }));
    assert.equal(view.root.findAllByType('iframe').length, 1);
    assert.doesNotMatch(JSON.stringify(diagnostics), /test-private-key|provider.test|-31.95|115.86/);
    assert.ok(diagnostics.some(([, data]) => data.status === 401)); await unmount(view);
  });
  await t.test('production fallback has no technical UI or technical console output', async () => {
    global.__DEV__ = false;
    try {
      const view = await mount({ mapTilerApiKey: undefined });
      assert.equal(view.root.findAllByType('iframe').length, 1);
      assert.doesNotMatch(text(view.toJSON()), /MapTiler|key|style|alternate map/);
      assert.equal(diagnostics.length, 0); await unmount(view);
    } finally { global.__DEV__ = true; }
  });
  await t.test('placeholder keys and invalid styles are detected; saved viewports retain their zoom', async () => {
    assert.equal(resolveWebMapConfig('your_public_maptiler_key').keyIssue, 'invalid-key');
    assert.equal(resolveWebMapConfig('test-private-key', 'http://insecure/style.json').styleIssue, 'invalid-style');
    assert.equal(resolveWebMapConfig('test-private-key', 'https://maps.example.test/custom/style.json').styleUrl, 'https://maps.example.test/custom/style.json');
    assert.ok(viewportZoom({ latitudeDelta: 0.5, longitudeDelta: 0.7 }) > 8);
    const view = await mount({ mapTilerApiKey: 'invalid' }); assert.equal(view.root.findAllByType('iframe').length, 1); await unmount(view);
  });
});
