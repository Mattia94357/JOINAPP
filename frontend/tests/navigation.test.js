const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const getStateFromPath = require('@react-navigation/core/lib/commonjs/getStateFromPath').default;
global.__DEV__ = false;

let user = null;
let screenNames = [];
let linking;
const originalLoad = Module._load;
const Screen = () => null;
const Navigator = ({ children }) => {
  const names = [];
  const visit = (node) => React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) visit(child.props.children);
    else if (child.type === Screen) names.push(child.props.name);
  });
  visit(children);
  assert.equal(new Set(names).size, names.length, 'a navigator cannot register duplicate screen names');
  screenNames = names;
  return React.createElement('Navigator', null, children);
};
const passthrough = ({ children }) => children;
const fakeScreen = () => null;
Module._load = function(name, parent, isMain) {
  if (name === 'react-native') return {
    View: 'View', Text: 'Text', ActivityIndicator: 'Spinner', Platform: { OS: 'web' },
    StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => ({ width: 390 }),
  };
  if (name === '@react-navigation/native') return {
    NavigationContainer: React.forwardRef(({ children, linking: config }, _ref) => {
      linking = config;
      return React.createElement('NavigationContainer', null, children);
    }),
    useNavigationContainerRef: () => ({ isReady: () => false, getCurrentRoute: () => undefined }),
  };
  if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({ Navigator, Screen }) };
  if (name === 'react-native-safe-area-context') return { SafeAreaProvider: passthrough };
  if (name === 'expo-status-bar') return { StatusBar: fakeScreen };
  if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { extra: { PUBLIC_APP_URL: 'https://join.example.test' } } } };
  if (name.startsWith('./src/screens/')) return { __esModule: true, default: fakeScreen, MessageRequestsScreen: fakeScreen };
  if (name === './src/context/AuthContext') return { AuthProvider: passthrough, useAuth: () => ({ user, loading: false }) };
  if (name === './src/context/MessagingContext') return { MessagingProvider: passthrough };
  if (name === './src/context/NotificationContext') return { NotificationProvider: passthrough };
  if (name === './src/hooks/useNativePushRouting') return { useNativePushRouting: () => () => {} };
  if (name === './src/theme') return { colors: { background: '#000', text: '#fff', border: '#333', shadow: '#000' } };
  if (name === './src/api') return { getApiConfigStatus: () => ({ apiUrl: 'https://api.example.test' }),
    initializeApiConfig: async () => ({ apiUrl: 'https://api.example.test' }) };
  if (name.startsWith('./src/components/')) return { __esModule: true, default: passthrough };
  return originalLoad.call(this, name, parent, isMain);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile;
require.extensions['.ts'] = compile;

(async () => {
  const App = require('../App.tsx').default;
  assert.equal(typeof App, 'function');
  let view;
  await act(async () => { view = create(React.createElement(App)); });
  assert.ok(screenNames.includes('Onboarding'), 'logged-out navigator renders');
  assert.ok(screenNames.includes('Login'));
  assert.equal(screenNames.filter((name) => name === 'Activity').length, 1, 'invite preview is routable before login');
  assert.equal(linking.config.screens.Activity.path, 'activities/:activityId');
  assert.equal(linking.config.screens.Activity.parse.inviteCode('retained-code'), 'retained-code');
  const inviteState = getStateFromPath('activities/private-plan?inviteCode=retained-code', linking.config);
  assert.deepEqual(inviteState.routes[0], { name: 'Activity', path: 'activities/private-plan?inviteCode=retained-code',
    params: { activityId: 'private-plan', inviteCode: 'retained-code' } });

  user = { id: 'member' };
  await act(async () => { view.update(React.createElement(App)); });
  assert.ok(screenNames.includes('Home'), 'authenticated navigator renders after login');
  assert.equal(screenNames.filter((name) => name === 'Activity').length, 1, 'canonical Activity Details route remains');
  assert.ok(screenNames.includes('Notifications'));
  await act(async () => view.unmount());
  console.log('Navigation tests passed: logged-out and authenticated stacks, unique Activity route, invite link mapping.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });
