const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');

global.__DEV__ = false;
const originalLoad = Module._load;
const fixture = () => ({ id: 'me', name: 'Alex', bio: 'Original bio', aboutMe: 'Original bio', languages: ['English', 'Sardinian'], interests: ['Food'], instagram: '@alex', ageRange: '25-34', gender: 'prefer_not_to_say', location: 'Perth, Western Australia, Australia', savedActivities: [] });
let user = fixture();
let calls = [];
let alerts = [];
let saveFails = false;
const Insets = React.createContext({ bottom: 0 });
Module._load = function(name, parent, main) {
  if (name === 'react-native') return {
    View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', ScrollView: 'ScrollView', Image: 'Image',
    ActivityIndicator: 'Spinner', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'web' },
    Modal: props => props.visible ? React.createElement('Modal', props, props.children) : null,
    Alert: { alert: (...args) => alerts.push(args) }, useWindowDimensions: () => ({ width: 390, height: 844 }),
    StyleSheet: { create: styles => styles, hairlineWidth: 1, absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
  };
  if (name === 'react-native-safe-area-context') return { SafeAreaInsetsContext: Insets, SafeAreaView: 'SafeAreaView' };
  if (name === '@expo/vector-icons') return { Ionicons: () => null };
  if (name === 'expo-image-picker') return {};
  if (name === '../context/AuthContext') return { useAuth: () => ({ user, token: 'auth-token', updateUser: async next => { user = next; } }) };
  if (name === '../utils/locationService') return { getCurrentJoinPlaceResult: async () => ({ status: 'success', place: fixture().location }) };
  if (name === '../utils/mediaPermissions') return { choosePhotoSource() {}, pickProfileImage: async () => null };
  if (name === '../api') return {
    fetchOwnActivityHistoryRequest: async () => ({ data: { hostedActivities: [], joinedActivities: [], hostedCount: 0, joinedCount: 0 } }),
    fetchUserMomentsRequest: async () => ({ data: { moments: [], total: 0 } }),
    updateProfileRequest: async (payload, token) => { calls.push([payload, token]); if (saveFails) throw new Error('offline'); return { data: { ...user, ...payload } }; },
  };
  if (name === '../components/BottomNavigation') return { __esModule: true, default: () => React.createElement('BottomNavigation'), BOTTOM_NAV_WEB_CONTENT_CLEARANCE: 100, getBottomNavigationClearance: () => 100 };
  if (['../components/AvatarBadge', '../components/ProfileHistoryTabs', '../components/LatestMomentSection', '../components/ProfileMomentsModal'].includes(name)) return { __esModule: true, default: () => null };
  return originalLoad.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile;
require.extensions['.ts'] = compile;
const Profile = require('../src/screens/ProfileScreen').default;
const ParticipantStepper = require('../src/components/ParticipantStepper').default;
const { SoftTextInput } = require('../src/components/CinematicControls');
const { ActivityDateSelector, ActivityTimeSelector, activityTimeOptions } = require('../src/components/ActivityDateTimeSelectors');
const text = node => typeof node === 'string' ? node : (Array.isArray(node) ? node : node?.children || []).map(text).join('');
const body = view => text(view.toJSON());
const button = (view, label) => view.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label || text(node) === label);
const input = (view, label) => view.root.findAllByType('Input').find(node => node.props.accessibilityLabel === label);
async function press(view, label) { const found = button(view, label); assert.ok(found, `button exists: ${label}`); assert.ok(!found.props.disabled, `button enabled: ${label}`); await act(async () => found.props.onPress()); }
async function fill(view, label, value) { assert.ok(input(view, label), `input exists: ${label}`); await act(async () => input(view, label).props.onChangeText(value)); }
async function mount(Component = Profile, props = {}) { let view; await act(async () => { view = create(React.createElement(Component, { navigation: { navigate() {} }, ...props })); }); return view; }
async function unmount(view) { await act(async () => view.unmount()); }
const flatten = style => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style]));

test('Profile editing and shared activity selectors', async t => {
  t.after(() => { Module._load = originalLoad; });
  t.beforeEach(() => { user = fixture(); calls = []; alerts = []; saveFails = false; });
  await t.test('Profile details remains read-only by default, with original content and navigation', async () => {
    const view = await mount();
    for (const value of ['Profile details', 'Original bio', 'English, Sardinian', '25-34', '@alex', fixture().location]) assert.ok(body(view).includes(value), value);
    assert.ok(button(view, 'Edit profile')); assert.ok(button(view, 'Change location'));
    assert.equal(view.root.findAllByType('Input').length, 0);
    assert.equal(view.root.findAllByType('BottomNavigation').length, 1); assert.equal(calls.length, 0);
    await press(view, 'Edit profile'); assert.ok(input(view, 'About me')); assert.ok(button(view, 'Save profile')); assert.ok(button(view, 'Cancel profile edits'));
    assert.equal(button(view, 'Edit profile'), undefined); await unmount(view);
  });
  await t.test('Languages is searchable, preserves existing custom values, confirms to draft and saves the same API model', async () => {
    const view = await mount(); await press(view, 'Edit profile'); await press(view, 'Languages');
    assert.equal(button(view, 'English').props.accessibilityRole, 'checkbox'); assert.equal(button(view, 'Sardinian').props.accessibilityState.checked, true);
    assert.equal(button(view, 'Sardinian').props.accessibilityChecked, true);
    await fill(view, 'Search languages', 'ital'); assert.equal(button(view, 'English'), undefined);
    await press(view, 'Italian'); assert.equal(button(view, 'Italian').props.accessibilityState.checked, true);
    await press(view, 'Done'); assert.equal(view.root.findAllByType('Modal').length, 0); assert.ok(body(view).includes('Italian')); assert.equal(calls.length, 0);
    await press(view, 'Save profile'); assert.deepEqual(calls[0][0].languages, ['English', 'Sardinian', 'Italian']); assert.equal(calls[0][1], 'auth-token');
    assert.equal(calls[0][0].location, undefined); assert.equal(calls[0][0].publicGender, undefined); assert.ok(button(view, 'Edit profile')); await unmount(view);
  });
  await t.test('Closing a language sheet discards pending choices; Cancel discards all confirmed profile drafts', async () => {
    const view = await mount(); await press(view, 'Edit profile'); await fill(view, 'About me', 'Unsaved biography');
    await press(view, 'Languages'); await press(view, 'Italian'); await press(view, 'Close languages selector');
    await press(view, 'Languages'); assert.equal(button(view, 'Italian').props.accessibilityState.checked, false);
    await press(view, 'Italian'); await press(view, 'Done'); await press(view, 'Cancel profile edits');
    assert.equal(calls.length, 0); assert.ok(!body(view).includes('Unsaved biography')); assert.ok(!body(view).includes('Italian'));
    await press(view, 'Edit profile'); assert.equal(input(view, 'About me').props.value, 'Original bio');
    await press(view, 'Languages'); assert.equal(button(view, 'Italian').props.accessibilityState.checked, false); await unmount(view);
  });
  await t.test('Current location stays device-derived and read-only, and Change location retains Passport Mode explanation', async () => {
    const view = await mount(); await press(view, 'Edit profile');
    assert.ok(body(view).includes(fixture().location)); assert.equal(input(view, 'Location'), undefined);
    await press(view, 'Change location'); assert.match(body(view), /Passport Mode/); assert.match(body(view), /will require an upgrade and is not available yet/);
    assert.equal(view.root.findAllByType('Input').filter(node => /location/i.test(node.props.accessibilityLabel || '')).length, 0);
    assert.equal(calls.length, 0); await unmount(view);
  });
  await t.test('Gender has consistent single selection without visibility controls; optional text and interests retain values', async () => {
    const view = await mount(); await press(view, 'Edit profile'); await press(view, 'Gender');
    assert.equal(button(view, 'Prefer not to say').props.accessibilityState.checked, true);
    await press(view, 'Non-binary'); await press(view, 'Done');
    assert.ok(!/host.gender|hidden|visible|debug|beta/i.test(body(view)));
    await press(view, 'Instagram'); await fill(view, 'Instagram', '@discarded'); await press(view, 'Close instagram selector');
    await press(view, 'Instagram'); assert.equal(input(view, 'Instagram').props.value, '@alex'); await fill(view, 'Instagram', '@updated'); await press(view, 'Done');
    await press(view, 'Age range'); await fill(view, 'Age range', '30-39'); await press(view, 'Done');
    await press(view, 'Interests'); await fill(view, 'Search interests', 'Pottery'); await press(view, 'Add Pottery'); await press(view, 'Done');
    await press(view, 'Save profile'); assert.deepEqual(calls[0][0], { aboutMe: 'Original bio', bio: 'Original bio', languages: ['English', 'Sardinian'], interests: ['Food', 'Pottery'], instagram: '@updated', ageRange: '30-39', gender: 'non_binary' }); await unmount(view);
  });
  await t.test('Failed Profile save keeps edits available and re-enables Save', async () => {
    const view = await mount(); await press(view, 'Edit profile'); await fill(view, 'About me', 'Keep this draft'); saveFails = true;
    await press(view, 'Save profile'); assert.equal(alerts.at(-1)[0], 'Unable to save profile'); assert.equal(input(view, 'About me').props.value, 'Keep this draft'); assert.equal(button(view, 'Save profile').props.disabled, false);
    saveFails = false; await press(view, 'Save profile'); assert.equal(calls.at(-1)[0].aboutMe, 'Keep this draft'); await unmount(view);
  });
  await t.test('Calendar opens and closes without losing its value, commits a selected date and disables past dates', async () => {
    const year = new Date().getFullYear() + 1; let changes = [];
    const view = await mount(ActivityDateSelector, { value: `${year}-03-10`, onChange: value => changes.push(value) });
    await press(view, 'Choose activity date'); await press(view, 'Close'); assert.deepEqual(changes, []);
    await press(view, 'Choose activity date'); const target = new Date(year, 2, 12);
    await press(view, target.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    assert.deepEqual(changes, [`${year}-03-12`]); assert.equal(view.root.findAllByType('Modal').length, 0); await unmount(view);
    const old = await mount(ActivityDateSelector, { value: '2000-01-01', onChange() { assert.fail('past date committed'); } }); await press(old, 'Choose activity date');
    const past = new Date(2000, 0, 1).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); assert.equal(button(old, past).props.disabled, true); await unmount(old);
  });
  await t.test('Time sheet retains exactly 48 half-hour choices, dismisses safely, and supports clearing optional end time', async () => {
    const changes = []; const view = await mount(ActivityTimeSelector, { value: '12:00', label: 'End time', optional: true, onChange: value => changes.push(value) });
    assert.equal(activityTimeOptions.length, 48); assert.equal(new Set(activityTimeOptions.map(item => item.value)).size, 48);
    assert.ok(activityTimeOptions.every(item => /:(00|30)$/.test(item.value)));
    await press(view, 'Choose end time'); assert.equal(button(view, activityTimeOptions.find(item => item.value === '12:00').label).props.accessibilityState.selected, true);
    await press(view, 'Close'); assert.deepEqual(changes, []); await press(view, 'Choose end time');
    await press(view, activityTimeOptions.find(item => item.value === '10:30').label); assert.deepEqual(changes, ['10:30']); assert.equal(view.root.findAllByType('Modal').length, 0);
    await press(view, 'Choose end time'); await press(view, 'No end time'); assert.deepEqual(changes, ['10:30', '']); await unmount(view);
  });
  await t.test('Participant +/- controls preserve minimum and string state contract with large tap targets', async () => {
    let current; function Harness() { const [value, onChange] = React.useState('2'); current = value; return React.createElement(ParticipantStepper, { value, onChange }); }
    const view = await mount(Harness); assert.equal(button(view, 'Decrease participants').props.disabled, true);
    assert.ok(flatten(button(view, 'Increase participants').props.style).height >= 44);
    await press(view, 'Increase participants'); assert.equal(current, '3'); await press(view, 'Decrease participants'); assert.equal(current, '2'); assert.equal(button(view, 'Decrease participants').props.disabled, true); await unmount(view);
  });
  await t.test('Soft text inputs expose a visible focus treatment and keep free-text editing intact', async () => {
    const view = await mount(SoftTextInput, { accessibilityLabel: 'Biography', value: 'Text', multiline: true, onChangeText() {} });
    const field = input(view, 'Biography'); const rest = flatten(field.props.style); assert.ok(rest.minHeight >= 160); assert.equal(rest.borderColor, 'transparent');
    await act(async () => field.props.onFocus({})); assert.notEqual(flatten(field.props.style).borderColor, 'transparent');
    await act(async () => field.props.onBlur({})); assert.equal(flatten(field.props.style).borderColor, 'transparent'); await unmount(view);
  });
});
