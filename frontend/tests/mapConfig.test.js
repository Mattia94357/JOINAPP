const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const originalLoad = Module._load;
let constants = {};
Module._load = function(name, parent, main) {
  if (name === 'expo-constants') return { __esModule: true, default: constants };
  return originalLoad.call(this, name, parent, main);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { getMapTilerConfig } = require('../src/utils/mapConfig');
test('Expo 48 production web key configuration', async t => {
  const original = process.env.EXPO_PUBLIC_MAPTILER_API_KEY;
  const originalEnvironment = process.env.VERCEL_ENV;
  t.after(() => { Module._load = originalLoad; if (original === undefined) delete process.env.EXPO_PUBLIC_MAPTILER_API_KEY; else process.env.EXPO_PUBLIC_MAPTILER_API_KEY = original;
    if (originalEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = originalEnvironment; });
  await t.test('the exact public variable survives app config and Expo Webpack production manifest injection', () => {
    process.env.EXPO_PUBLIC_MAPTILER_API_KEY = 'test-public-map-key-123'; process.env.VERCEL_ENV = 'production';
    delete require.cache[require.resolve('../app.config.js')];
    const config = require('../app.config.js')({ config: { sdkVersion: '48.0.0' } });
    const { createClientEnvironment } = require('@expo/webpack-config/webpack/plugins/ExpoDefinePlugin');
    const injected = createClientEnvironment('production', '/', config, 'web');
    const env = injected['process.env'];
    const manifest = JSON.parse(env.APP_MANIFEST);
    // Prove the browser uses extra, not the unsupported direct process.env path.
    delete process.env.EXPO_PUBLIC_MAPTILER_API_KEY;
    Object.assign(constants, { expoConfig: { extra: {} }, manifest });
    assert.equal(getMapTilerConfig().apiKey, 'test-public-map-key-123');
    assert.equal(manifest.extra.MAPTILER_BUILD_ENV, 'production');
    assert.equal(env.EXPO_PUBLIC_MAPTILER_API_KEY, undefined);
  });
  await t.test('missing key remains visibly unconfigured, never a fabricated key', () => {
    for (const key of Object.keys(constants)) delete constants[key]; delete process.env.EXPO_PUBLIC_MAPTILER_API_KEY;
    assert.equal(getMapTilerConfig().apiKey, undefined);
  });
});
