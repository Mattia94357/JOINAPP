const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const originalLoad = Module._load;
let token = 'test-token';
let blocked = [{ id: 'blocked', name: 'Blocked member', avatar: 'test.jpg' }];
let fail = false;
const reports = [];
const unblocked = [];
Module._load = function(name, parent, main) {
  if (name === 'react-native') return {
    View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', ScrollView: 'ScrollView',
    Modal: (props) => props.visible ? React.createElement('Modal', props, props.children) : null,
    ActivityIndicator: 'Spinner', StyleSheet: { create: (styles) => styles },
  };
  if (name === '@react-navigation/native') return { useFocusEffect: (callback) => React.useEffect(callback, [callback]) };
  if (name === '../context/AuthContext') return { useAuth: () => ({ token }) };
  if (name.endsWith('/AvatarBadge')) return { __esModule: true, default: () => null };
  if (name === '../api') return {
    fetchBlockedUsersRequest: async () => ({ data: blocked }),
    unblockUserRequest: async (id) => { if (fail) throw Error('offline'); unblocked.push(id); },
    submitReportRequest: async (...args) => { if (fail) throw Error('offline'); reports.push(args); },
  };
  return originalLoad.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile; require.extensions['.ts'] = compile;
const ReportButton = require('../src/components/ReportButton').default;
const BlockedUsers = require('../src/screens/BlockedUsersScreen').default;
const text = (node) => typeof node === 'string' ? node : (Array.isArray(node) ? node : node?.children || []).map(text).join(' ');
const mount = async (component, props = {}) => { let view; await act(async () => { view = create(React.createElement(component, props)); }); return view; };
const press = async (view, label) => act(async () => view.root.findAllByType('Button').find((node) => node.props.accessibilityLabel === label).props.onPress());

(async () => {
  let view = await mount(BlockedUsers);
  assert.match(text(view.toJSON()), /Blocked member/);
  await press(view, 'Unblock Blocked member');
  assert.equal(unblocked.length, 0); // Confirmation is required, not an immediate write.
  assert.match(text(view.toJSON()), /Unblock\s+Blocked member\s*\?/);
  fail = true;
  await press(view, 'Confirm unblock Blocked member');
  assert.match(text(view.toJSON()), /Unable to unblock/);
  fail = false;
  await press(view, 'Confirm unblock Blocked member');
  assert.deepEqual(unblocked, ['blocked']);
  assert.match(text(view.toJSON()), /No blocked users/);
  await act(async () => view.unmount());

  for (const targetType of ['user', 'activity', 'moment', 'comment']) {
    view = await mount(ReportButton, { targetType, targetId: `${targetType}-id`, label: `Report ${targetType}` });
    await press(view, `Report ${targetType}`);
    assert.equal(view.root.findAllByType('Button').find((node) => node.props.accessibilityLabel === 'Submit report').props.disabled, true);
    const reason = view.root.findAllByType('Button').find((node) => node.props.accessibilityRole === 'radio');
    await act(async () => reason.props.onPress());
    const input = view.root.findByType('Input');
    assert.equal(input.props.maxLength, 1000);
    await act(async () => input.props.onChangeText('Bounded detail'));
    fail = true;
    await press(view, 'Submit report');
    assert.match(text(view.toJSON()), /Unable to send report/);
    fail = false;
    await press(view, 'Submit report');
    assert.deepEqual(reports.at(-1), [targetType, `${targetType}-id`, 'Spam', 'Bounded detail', token]);
    assert.match(text(view.toJSON()), /Report submitted/);
    await press(view, 'Close report');
    assert.equal(view.root.findAllByType('Modal').length, 0);
    await act(async () => view.unmount());
  }
  token = null;
  view = await mount(ReportButton, { targetType: 'user', targetId: 'test', label: 'Report user' });
  await press(view, 'Report user');
  assert.match(text(view.toJSON()), /Sign in to submit/);
  assert.equal(view.root.findAllByType('Input').length, 0);
  await act(async () => view.unmount());
  console.log('Safety UI tests passed: confirmation/empty/error states, four report types, bounded detail, authentication.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
