const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const originalLoad = Module._load;
const storage = new Map();
const native = { Platform: { OS: 'ios' }, AppState: {
  currentState: 'active', addEventListener: (_, fn) => { activeListeners.add(fn); return { remove: () => activeListeners.delete(fn) }; },
} };
const activeListeners = new Set(), tokenListeners = new Set(), receivedListeners = new Set(), tapListeners = new Set();
const listen = (set) => (fn) => { set.add(fn); return { remove: () => set.delete(fn) }; };
let permission = { status: 'granted', granted: true, canAskAgain: true };
let prompted = 0, channels = 0, receivedRefreshes = 0, tokenFailure = false, revokeFailure = false;
let coldResponse = null;
const projectId = randomUUID();
const constants = { expoConfig: { extra: { eas: { projectId } } } };
let lastOptions;
const expo = {
  setNotificationHandler: () => {}, AndroidImportance: { HIGH: 4 }, IosAuthorizationStatus: { PROVISIONAL: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'default',
  setNotificationChannelAsync: async () => { channels++; },
  getPermissionsAsync: async () => permission,
  requestPermissionsAsync: async () => { prompted++; return permission; },
  getExpoPushTokenAsync: async (options) => { lastOptions = options; if (tokenFailure) throw new Error('offline'); return { data: 'ExpoPushToken[test]' }; },
  addPushTokenListener: listen(tokenListeners), addNotificationReceivedListener: listen(receivedListeners),
  addNotificationResponseReceivedListener: listen(tapListeners), getLastNotificationResponseAsync: async () => coldResponse,
};
const registered = [], revoked = [], navigated = [], read = [];
const nid = '111111111111111111111111', aid = '222222222222222222222222';
let fakeToken = null, activityFailure = false, ownedFailure = false;
const api = {
  fetchCurrentUserRequest: async () => ({ data: { id: 'user', name: 'User' } }),
  loginRequest: async () => ({ data: { token: 'login-token', user: { id: 'user' } } }),
  registerRequest: async () => ({ data: { token: 'signup-token', user: { id: 'user' } } }),
  registerPushDeviceRequest: async (...args) => { registered.push(args); return { data: { registrationId: randomUUID() } }; },
  revokePushDeviceRequest: async (...args) => { revoked.push(args); if (revokeFailure) throw new Error('offline'); },
  fetchNotificationCountRequest: async () => { receivedRefreshes++; return { data: { unreadCount: 1 } }; },
  onActivityMutation: () => () => {},
  fetchNotificationRequest: async (id) => {
    if (ownedFailure) throw { response: { status: 404 } };
    return { data: { id, type: 'join_approved', target: { type: 'activity', activityId: aid } } };
  },
  markNotificationReadRequest: async (id) => { read.push(id); return {}; },
  fetchActivity: async () => { if (activityFailure) throw { response: { status: 403 } }; return {}; },
};
Module._load = function(name, parent, isMain) {
  if (name === 'react-native') return native;
  if (name === 'expo-notifications') return expo;
  if (name === 'expo-device') return { isDevice: true };
  if (name === 'expo-crypto') return { randomUUID };
  if (name === 'expo-constants') return { __esModule: true, default: constants };
  if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: {
    getItem: async (key) => storage.get(key) || null,
    setItem: async (key, value) => { storage.set(key, value); }, removeItem: async (key) => { storage.delete(key); },
  } };
  if (name === '../api') return api;
  if (name === '../context/AuthContext' || name === './AuthContext') return { useAuth: () => ({ token: fakeToken }) };
  return originalLoad.call(this, name, parent, isMain);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile; require.extensions['.ts'] = compile;
const { AuthProvider, useAuth } = require('../src/context/AuthContext');
const { NotificationProvider } = require('../src/context/NotificationContext');
const { useNativePushRouting } = require('../src/hooks/useNativePushRouting');
const { registerForPushNotificationsAsync } = require('../src/utils/notifications');
const flush = async () => { await act(async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); }); };
let auth, ready;
const CaptureAuth = () => { auth = useAuth(); return null; };
const nav = { isReady: () => true, navigate: (...args) => navigated.push(args) };
const CaptureRouting = () => { ready = useNativePushRouting(nav); return null; };
const response = (id = nid) => ({ actionIdentifier: 'default', notification: { request: {
  identifier: id, content: { data: { notificationId: id, type: 'join_approved', activityId: aid } },
} } });

(async () => {
  storage.set('@joinapp:user', JSON.stringify({ id: 'user' })); storage.set('@joinapp:token', 'restored-token');
  let tree;
  await act(async () => { tree = create(React.createElement(AuthProvider, null, React.createElement(CaptureAuth))); });
  await flush();
  assert.equal(auth.token, 'restored-token'); assert.equal(registered.length, 1);
  assert.equal(registered[0][2], 'restored-token'); assert.equal(lastOptions.projectId, projectId);
  await act(async () => auth.logout());
  assert.equal(revoked.length, 1); assert.equal(auth.token, null);
  await act(async () => auth.login('email', 'password')); await flush();
  assert.equal(registered.length, 2); assert.equal(registered[1][2], 'login-token');
  for (const fn of tokenListeners) fn({ type: 'ios', data: 'rotated-native-token' });
  await flush(); assert.equal(lastOptions.devicePushToken.data, 'rotated-native-token');
  revokeFailure = true;
  await act(async () => auth.logout()); assert.equal(auth.token, null); revokeFailure = false;
  permission = { status: 'denied', granted: false, canAskAgain: false };
  const previousRegistrations = registered.length;
  await act(async () => auth.login('email', 'password')); await flush();
  assert.equal(auth.token, 'login-token'); assert.equal(registered.length, previousRegistrations); assert.equal(prompted, 0);
  await act(async () => tree.unmount());
  permission = { status: 'granted', granted: true, canAskAgain: true };
  tokenFailure = true; assert.equal(await registerForPushNotificationsAsync(), null); tokenFailure = false;
  native.Platform.OS = 'android'; await registerForPushNotificationsAsync(); assert.ok(channels > 0);
  native.Platform.OS = 'web'; assert.equal(await registerForPushNotificationsAsync(), null);
  native.Platform.OS = 'ios';
  delete constants.expoConfig.extra.eas.projectId;
  assert.equal(await registerForPushNotificationsAsync(), null);
  constants.expoConfig.extra.eas.projectId = projectId;

  coldResponse = response(); fakeToken = null;
  const routeTree = () => React.createElement(NotificationProvider, null, React.createElement(CaptureRouting));
  await act(async () => { tree = create(routeTree()); }); await flush();
  assert.equal(navigated.length, 0);
  await act(async () => ready()); assert.equal(navigated.length, 0);
  fakeToken = 'signed-in'; await act(async () => tree.update(routeTree())); await flush();
  assert.deepEqual(navigated, [['Activity', { activityId: aid }]]); assert.deepEqual(read, [nid]);
  for (const fn of tapListeners) fn(response()); await flush(); assert.equal(navigated.length, 1);
  const oldRefreshes = receivedRefreshes;
  for (const fn of receivedListeners) fn({}); await flush(); assert.ok(receivedRefreshes > oldRefreshes);
  activityFailure = true;
  for (const fn of tapListeners) fn(response('333333333333333333333333')); await flush();
  assert.deepEqual(navigated.at(-1), ['Notifications']);
  ownedFailure = true;
  const readCount = read.length;
  for (const fn of tapListeners) fn(response('444444444444444444444444')); await flush();
  assert.equal(read.length, readCount); assert.deepEqual(navigated.at(-1), ['Notifications']);
  await act(async () => tree.unmount());
  assert.equal(receivedListeners.size, 0); assert.equal(tapListeners.size, 0);
  console.log('Native push tests passed: restored/login registration, logout, denied permissions, rotation, channel, foreground count, cold start, deduplication, safe routing.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });
