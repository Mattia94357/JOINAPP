const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');

// Exercise real screen hooks and interactions with native primitives and HTTP
// mocked at their boundaries; no Expo runtime or application server required.
const originalLoad = Module._load;
let page = [];
let fetchFailure = false;
let targetFailure = false;
let marked = [];
let allRead = 0;
let refreshed = 0;
const refresh = async () => { refreshed++; };
const api = {
  fetchNotificationsRequest: async () => {
    if (fetchFailure) throw new Error('offline');
    return { data: { notifications: page, nextCursor: null } };
  },
  markNotificationReadRequest: async (id) => { marked.push(id); return { data: { id, readAt: '2026-09-18T00:00:00Z' } }; },
  markAllNotificationsReadRequest: async () => { allRead++; page = page.map((n) => ({ ...n, readAt: '2026-09-18T00:00:00Z' })); },
  fetchActivity: async () => { if (targetFailure) throw { response: { status: 403 } }; return {}; },
};
Module._load = function(name, parent, isMain) {
  if (name === 'react-native') return {
    View: 'View', Text: 'Text', TouchableOpacity: 'Button', ScrollView: 'ScrollView',
    ActivityIndicator: 'Spinner', RefreshControl: 'RefreshControl', StyleSheet: { create: (styles) => styles },
  };
  if (name === '@react-navigation/native') return { useFocusEffect: (fn) => React.useEffect(fn, [fn]) };
  if (name === '../context/AuthContext') return { useAuth: () => ({ token: 'test' }) };
  if (name === '../context/NotificationContext') return { useNotifications: () => ({ refresh }) };
  if (name === '../api') return api;
  if (name === '../components/BottomNavigation') return { __esModule: true, default: () => null };
  return originalLoad.call(this, name, parent, isMain);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile;
require.extensions['.ts'] = compile;
const Screen = require('../src/screens/NotificationsScreen').default;
const text = (node) => typeof node === 'string' ? node : (node?.children || []).map(text).join(' ');
const navigated = [];
const navigation = { navigate: (...args) => navigated.push(args) };
const mount = async () => { let view; await act(async () => { view = create(React.createElement(Screen, { navigation })); }); return view; };
const button = (view, label) => view.root.findAllByType('Button').find((n) => text(n.toJSON ? n.toJSON() : { children: n.children.map((c) => typeof c === 'string' ? c : { children: c.children }) }).includes(label));

(async () => {
  let view = await mount();
  assert.match(text(view.toJSON()), /No notifications yet/);
  await act(async () => view.unmount());
  page = [{ id: 'one', type: 'join_approved', title: 'Join request approved', body: 'Your request was approved.',
    readAt: null, createdAt: '2026-09-18T00:00:00Z', target: { type: 'activity', activityId: 'activity-one' }, activityTitle: 'Beach walk' }];
  view = await mount();
  assert.match(text(view.toJSON()), /Beach walk/);
  assert.match(text(view.toJSON()), /Unread/);
  await act(async () => view.root.findByProps({ accessibilityLabel: 'Unread: Join request approved' }).props.onPress());
  assert.deepEqual(marked, ['one']);
  assert.deepEqual(navigated, [['Activity', { activityId: 'activity-one' }]]);
  assert.equal(view.root.findByProps({ accessibilityLabel: 'Read: Join request approved' }).props.disabled, false);
  await act(async () => view.unmount());

  view = await mount();
  await act(async () => button(view, 'Mark all as read').props.onPress());
  assert.equal(allRead, 1);
  assert.doesNotMatch(text(view.toJSON()), /Unread/);
  assert.ok(refreshed >= 3);
  await act(async () => view.unmount());

  targetFailure = true;
  view = await mount();
  await act(async () => view.root.findByProps({ accessibilityLabel: 'Read: Join request approved' }).props.onPress());
  assert.match(text(view.toJSON()), /no longer available/);
  assert.equal(navigated.length, 1);
  await act(async () => view.unmount());
  fetchFailure = true;
  view = await mount();
  assert.match(text(view.toJSON()), /Could not load notifications/);
  assert.doesNotMatch(text(view.toJSON()), /No notifications yet/);
  await act(async () => view.unmount());
  console.log('Notification screen tests passed: empty, populated, unread, mark one/all, navigation, revoked access, network failure.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });
