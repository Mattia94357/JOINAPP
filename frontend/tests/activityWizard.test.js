const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');

global.__DEV__ = false;
const originalLoad = Module._load;
let token = 'auth-token';
let apiCalls = [];
let queries = [];
let geocodeFailure = false;
let submit = async () => ({ data: { id: 'new-plan' } });
let fetchFeed = async () => [];
let photo = { uri: 'file:///new-cover.jpg', base64: 'ZGF0YQ==' };
let width = 390;
let platform = 'web';
let hardwareBack;
let uuid = 0;
const alerts = [];
const windowListeners = new Map();
const previousWindow = global.window;
global.window = { addEventListener: (name, fn) => windowListeners.set(name, fn), removeEventListener: name => windowListeners.delete(name) };
class AnimationValue {
  setValue() {}
  stopAnimation() {}
  interpolate() { return 0; }
}
const Scroll = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({ scrollTo() {} }));
  return React.createElement('ScrollView', props, props.children);
});
Module._load = function(name, parent, main) {
  if (name === 'react-native') return {
    View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', Image: 'Image',
    ScrollView: Scroll, SafeAreaView: 'SafeAreaView', KeyboardAvoidingView: 'KeyboardAvoidingView',
    ActivityIndicator: 'Spinner', Modal: props => props.visible ? React.createElement('Modal', props, props.children) : null,
    Platform: { get OS() { return platform; } }, Alert: { alert: (...args) => alerts.push(args) },
    BackHandler: { addEventListener: (_event, callback) => { hardwareBack = callback; return { remove: () => { hardwareBack = undefined; } }; } },
    StyleSheet: { create: styles => styles, hairlineWidth: 1 }, useWindowDimensions: () => ({ width, height: 844 }),
    Animated: { Value: AnimationValue, View: 'AnimatedView', timing: () => ({ start() {}, stop() {} }) },
  };
  if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
  if (name === '@expo/vector-icons') return { Ionicons: () => null };
  if (name === 'expo-crypto') return { randomUUID: () => `draft-${++uuid}` };
  if (name === '@react-navigation/native') return { CommonActions: { setParams: params => ({ type: 'SET_PARAMS', payload: params }) }, useFocusEffect: callback => React.useEffect(callback, [callback]) };
  if (name === '../context/AuthContext') return { useAuth: () => ({ token, user: { id: 'me', name: 'Sam', savedActivities: [] }, updateUser: async () => {} }) };
  if (name === '../api') return {
    createActivityRequest: async (...args) => { apiCalls.push(args); return submit(...args); },
    fetchActivities: (...args) => fetchFeed(...args),
  };
  if (name === '../utils/mapConfig') return { geocodeActivityLocation: async query => { queries.push(query); if (geocodeFailure) throw new Error('Unable to resolve this activity location.'); return { latitude: -31.95, longitude: 115.86 }; } };
  if (name === '../utils/locationService') return { getCurrentJoinLocation: async () => ({ latitude: -31.95, longitude: 115.86 }) };
  if (name === '../utils/safeError') return { reportFrontendError() {} };
  if (name === '../utils/mediaPermissions') return { chooseActivityPhotoSource: callback => callback('library'), pickActivityImage: async () => photo };
  if (name === '../components/SwipeDeck') return { __esModule: true, default: props => React.createElement('Deck', props) };
  if (name === '../components/ParticipantsModal') return { __esModule: true, default: () => null };
  if (name === '../components/BottomNavigation') return { __esModule: true, default: () => React.createElement('BottomNavigation'), BOTTOM_NAV_HEIGHT: 64 };
  return originalLoad.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile;
require.extensions['.ts'] = compile;
const Wizard = require('../src/screens/CreateActivityScreen').default;
const Home = require('../src/screens/HomeScreen').default;
const ParticipantStepper = require('../src/components/ParticipantStepper').default;
const { ActivityDateSelector, ActivityTimeSelector, activityTimeOptions } = require('../src/components/ActivityDateTimeSelectors');
const { resolveActivityImage } = require('../src/utils/activityAssets');
const futureDate = `${new Date().getFullYear() + 1}-10-20`;
const text = node => typeof node === 'string' ? node : (Array.isArray(node) ? node : node?.children || []).map(text).join('');
const button = (view, label) => view.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label || text(node) === label);
const input = (view, label) => view.root.findAllByType('Input').find(node => node.props.accessibilityLabel === label);
const body = view => text(view.toJSON());
const flush = () => new Promise(resolve => setImmediate(resolve));
async function press(view, label) {
  const found = button(view, label);
  assert.ok(found, `button exists: ${label}`);
  assert.ok(!found.props.disabled, `button enabled: ${label}`);
  await act(async () => { await found.props.onPress(); });
}
async function fill(view, label, value) { await act(async () => label === 'Max participants' ? view.root.findByType(ParticipantStepper).props.onChange(value) : input(view, label).props.onChangeText(value)); }
function navigation() {
  const handlers = new Map(); const calls = [];
  return { calls, handlers, addListener: (event, callback) => { handlers.set(event, callback); return () => handlers.delete(event); },
    navigate: (...args) => calls.push(['navigate', ...args]), goBack: () => calls.push(['back']), canGoBack: () => true,
    dispatch: action => calls.push(['dispatch', action]), setParams() {} };
}
async function mount(Component = Wizard) {
  const nav = navigation(); let view;
  await act(async () => { view = create(React.createElement(Component, { navigation: nav, route: { params: {} } })); });
  return { view, nav };
}
async function unmount(view) { await act(async () => view.unmount()); }
async function dates(view, { date = futureDate, start = '10:30', end = '12:00' } = {}) {
  await act(async () => {
    view.root.findByType(ActivityDateSelector).props.onChange(date);
    view.root.findAllByType(ActivityTimeSelector).find(node => node.props.label === 'Start time').props.onChange(start);
    view.root.findAllByType(ActivityTimeSelector).find(node => node.props.label === 'End time').props.onChange(end);
  });
}
async function toReview(view, { privatePlan = false } = {}) {
  await fill(view, 'Activity title', 'Coffee & conversation'); await press(view, 'Next');
  await press(view, 'Food'); await press(view, 'Next');
  await fill(view, 'Location', 'Northbridge'); await fill(view, 'Venue name', 'Local cafe'); await fill(view, 'Meeting point', '12 Example St'); await press(view, 'Next');
  await dates(view); await press(view, 'Next');
  await fill(view, 'Max participants', '6'); if (privatePlan) await press(view, 'Private activity'); await press(view, 'Next');
  await fill(view, 'Description', 'Meet for great coffee and relaxed conversation with new people.'); await press(view, 'Next'); await press(view, 'Next');
}

test('JOIN Explore and Create Activity behavior', async t => {
  t.after(() => { Module._load = originalLoad; global.window = previousWindow; });
  await t.test('genuine empty state has exact copy, no outer border, and CTA uses the existing route', async () => {
    fetchFeed = async () => [];
    const { view, nav } = await mount(Home);
    assert.match(body(view), /No activities yet/);
    assert.match(body(view), /Other people will be joining soon\./);
    assert.match(body(view), /Create an activity to get things started\./);
    assert.ok(!body(view).includes('Real activities will appear'));
    const empty = view.root.findByProps({ testID: 'explore-empty-state' });
    assert.equal(empty.props.style.borderWidth, undefined);
    assert.equal(empty.props.style.justifyContent, 'center');
    await press(view, 'Create activity'); assert.deepEqual(nav.calls.at(-1), ['navigate', 'CreateActivity']);
    assert.ok(button(view, 'Filter')); assert.equal(view.root.findAllByType('BottomNavigation').length, 1);
    await unmount(view);
  });
  await t.test('loading and API error do not display the genuine empty state or its CTA', async () => {
    let rejectFeed; fetchFeed = () => new Promise((_resolve, reject) => { rejectFeed = reject; });
    const { view } = await mount(Home);
    assert.equal(view.root.findAllByType('Spinner').length, 1); assert.equal(button(view, 'Create activity'), undefined);
    await act(async () => { rejectFeed(new Error('offline')); await flush(); });
    assert.match(body(view), /Activities unavailable/); assert.ok(button(view, 'Retry loading activities'));
    assert.equal(button(view, 'Create activity'), undefined); await unmount(view);
  });
  await t.test('filtered-empty stays distinct and Reset filters restores the existing feed', async () => {
    fetchFeed = async () => [{ id: 'food', title: 'Lunch', category: 'Food', startsAt: `${futureDate}T10:30:00Z`, viewerJoinStatus: 'none', participants: [] }];
    const { view } = await mount(Home);
    assert.equal(view.root.findAllByType('Deck').length, 1);
    await press(view, 'Wellness'); assert.match(body(view), /No activities match these filters/);
    assert.equal(button(view, 'Create activity'), undefined); assert.ok(!body(view).includes('Other people will be joining soon.'));
    await press(view, 'Reset filters'); assert.equal(view.root.findAllByType('Deck').length, 1); await unmount(view);
  });
  await t.test('starts at Title, invalid Next is blocked, Back preserves title, and tabs are hidden', async () => {
    const { view, nav } = await mount();
    assert.ok(body(view).includes('What’s the activity called?')); assert.match(body(view), /1 of 8/);
    assert.equal(button(view, 'Next').props.disabled, true); assert.equal(view.root.findAllByType('BottomNavigation').length, 0);
    await fill(view, 'Activity title', '   '); assert.equal(button(view, 'Next').props.disabled, true);
    await fill(view, 'Activity title', 'Coffee & conversation'); await press(view, 'Next');
    assert.match(body(view), /Choose a category/); assert.equal(input(view, 'Activity title'), undefined);
    await press(view, 'Back'); assert.equal(input(view, 'Activity title').props.value, 'Coffee & conversation');
    assert.equal(apiCalls.length, 0); assert.deepEqual(nav.calls, []); await unmount(view);
  });
  await t.test('category, location, date/time, participation and description validate before Next', async () => {
    const { view } = await mount();
    await fill(view, 'Activity title', 'Morning plan'); await press(view, 'Next'); await press(view, 'Food'); await press(view, 'Next');
    assert.match(body(view), /Where is it happening/); assert.equal(button(view, 'Next').props.disabled, true);
    await fill(view, 'Location', 'Northbridge'); await press(view, 'Next'); assert.equal(button(view, 'Next').props.disabled, true);
    await dates(view, { date: '2000-01-01' }); assert.equal(button(view, 'Next').props.disabled, true);
    await dates(view, { end: '10:00' }); assert.equal(button(view, 'Next').props.disabled, true); assert.match(body(view), /End time must be after start time/);
    await dates(view, { end: '' }); await press(view, 'Next');
    await fill(view, 'Max participants', '1'); assert.equal(button(view, 'Next').props.disabled, true);
    await fill(view, 'Max participants', '2.5'); assert.equal(button(view, 'Next').props.disabled, true);
    await fill(view, 'Max participants', '6'); await press(view, 'Private activity'); await press(view, 'Next');
    await fill(view, 'Description', 'Short'); assert.equal(button(view, 'Next').props.disabled, true);
    await fill(view, 'Description', 'A relaxed conversation with people from the area.');
    await press(view, 'More details'); await press(view, 'Cost'); await press(view, 'Paid'); await press(view, 'Done'); assert.equal(button(view, 'Next').props.disabled, true);
    await press(view, 'Cost'); await fill(view, 'Cost in AUD', '15'); await press(view, 'Done'); await press(view, 'Next'); assert.match(body(view), /Add a cover image/);
    await press(view, 'Back'); await press(view, 'Cost'); assert.equal(input(view, 'Cost in AUD').props.value, '15'); await press(view, 'Close cost selector'); await press(view, 'Back');
    assert.equal(view.root.findByType(ParticipantStepper).props.value, '6'); assert.equal(button(view, 'Private activity').props.accessibilityState.selected, true);
    await press(view, 'Back'); assert.equal(view.root.findByType(ActivityDateSelector).props.value, futureDate);
    await press(view, 'Back'); assert.equal(input(view, 'Location').props.value, 'Northbridge');
    await press(view, 'Back'); assert.equal(button(view, 'Food').props.accessibilityState.selected, true); await unmount(view);
  });
  await t.test('cover preview supports default, choose, change, remove, oversize rejection and draft persistence', async () => {
    const { view } = await mount(); await toReview(view); await press(view, 'Back');
    const preview = () => view.root.findByProps({ accessibilityLabel: 'Activity cover preview' });
    assert.equal(preview().props.source.uri, resolveActivityImage({ category: 'Food' }));
    await press(view, 'Choose picture'); assert.equal(preview().props.source.uri, 'file:///new-cover.jpg');
    photo = { uri: 'file:///changed.jpg', base64: 'bmV3' }; await press(view, 'Change picture'); assert.equal(preview().props.source.uri, photo.uri);
    await press(view, 'Back'); await press(view, 'Next'); assert.equal(preview().props.source.uri, photo.uri);
    await press(view, 'Remove'); assert.equal(preview().props.source.uri, resolveActivityImage({ category: 'Food' }));
    photo = { uri: 'file:///too-big.jpg', base64: 'a'.repeat(6 * 1024 * 1024) }; await press(view, 'Choose picture');
    assert.match(body(view), /4 MB or smaller/); assert.equal(preview().props.source.uri, resolveActivityImage({ category: 'Food' }));
    photo = { uri: 'file:///new-cover.jpg', base64: 'ZGF0YQ==' }; await unmount(view);
  });
  await t.test('review reflects all required and optional draft values; publish keeps API/privacy/geocoding/image contracts', async () => {
    apiCalls = []; queries = [];
    const { view, nav } = await mount(); await toReview(view, { privatePlan: true });
    await press(view, 'Edit description and details'); await press(view, 'More details'); await press(view, 'Vibe'); await press(view, 'Creative'); await press(view, 'Done');
    await press(view, 'Cost'); await press(view, 'Paid'); await fill(view, 'Cost in AUD', '15'); await press(view, 'Done'); await press(view, 'Host note'); await fill(view, 'Host note', 'Meet at the door'); await press(view, 'Done'); await press(view, 'Cancellation note'); await fill(view, 'Cancellation note', 'Weather dependent'); await press(view, 'Done');
    await press(view, 'Next'); await press(view, 'Choose picture'); await press(view, 'Next');
    for (const value of ['Coffee & conversation', 'Food', 'Northbridge', 'Local cafe', '12 Example St', '6 participants', 'Private activity', 'Creative', 'AUD 15', 'Meet at the door', 'Weather dependent']) assert.ok(body(view).includes(value), `review contains ${value}`);
    assert.equal(view.root.findByProps({ accessibilityLabel: 'Review cover image' }).props.source.uri, photo.uri);
    await press(view, 'Publish plan'); assert.equal(apiCalls.length, 1);
    const [payload, auth] = apiCalls[0]; assert.equal(auth, 'auth-token');
    assert.deepEqual(queries, ['12 Example St, Local cafe, Northbridge']);
    assert.equal(payload.date, new Date(`${futureDate}T10:30:00`).toISOString()); assert.equal(payload.endDate, new Date(`${futureDate}T12:00:00`).toISOString());
    assert.equal(payload.maxAttendees, 6); assert.equal(payload.visibility, 'private'); assert.equal(payload.locationPrivacy, 'private'); assert.equal(payload.joinApproval, 'manual');
    assert.equal(payload.latitude, -31.95); assert.equal(payload.longitude, 115.86); assert.equal(payload.isApproximateLocation, false);
    assert.equal(payload.currency, 'AUD'); assert.equal(payload.costAmount, 15); assert.equal(payload.hostNote, 'Meet at the door'); assert.equal(payload.cancellationPolicy, 'Weather dependent');
    assert.equal(payload.coverImageData, 'data:image/jpeg;base64,ZGF0YQ=='); assert.ok(payload.clientRequestId); assert.deepEqual(nav.calls.at(-1), ['navigate', 'Home']);
    let prevented = false; nav.handlers.get('beforeRemove')({ preventDefault: () => { prevented = true; }, data: { action: { type: 'GO_BACK' } } }); assert.equal(prevented, false); await unmount(view);
  });
  await t.test('default-image public publish, API failure recovery, stable retry ID and duplicate prevention', async () => {
    apiCalls = []; let fail = true; submit = async () => { if (fail) throw new Error('offline'); return { data: { id: 'new-plan' } }; };
    const { view, nav } = await mount(); await toReview(view);
    assert.equal(view.root.findByProps({ accessibilityLabel: 'Review cover image' }).props.source.uri, resolveActivityImage({ category: 'Food' }));
    await press(view, 'Publish plan'); assert.match(body(view), /Could not post activity/); assert.equal(button(view, 'Publish plan').props.disabled, false); assert.deepEqual(nav.calls, []);
    assert.equal(apiCalls[0][0].visibility, 'public'); assert.equal(apiCalls[0][0].joinApproval, 'auto'); assert.equal(apiCalls[0][0].locationPrivacy, 'public'); assert.equal(apiCalls[0][0].coverImageData, undefined);
    fail = false; let finish; submit = () => new Promise(resolve => { finish = resolve; });
    const publish = button(view, 'Publish plan').props.onPress; let inFlight;
    await act(async () => { inFlight = publish(); await publish(); await flush(); });
    assert.equal(apiCalls.length, 2); assert.equal(button(view, 'Publish plan').props.disabled, true);
    assert.equal(apiCalls[0][0].clientRequestId, apiCalls[1][0].clientRequestId);
    await act(async () => { finish({ data: { id: 'new-plan' } }); await inFlight; });
    submit = async () => ({ data: { id: 'new-plan' } }); await unmount(view);
  });
  await t.test('Cancel and browser/native back preserve a dirty draft until discard is confirmed', async () => {
    const { view, nav } = await mount(); await fill(view, 'Activity title', 'Keep my draft');
    await press(view, 'Cancel creation'); assert.match(body(view), /Discard this draft/); assert.deepEqual(nav.calls, []);
    await press(view, 'Keep editing'); assert.equal(input(view, 'Activity title').props.value, 'Keep my draft');
    assert.ok(windowListeners.has('beforeunload')); let prevented = false; const unload = { preventDefault: () => { prevented = true; } }; windowListeners.get('beforeunload')(unload); assert.equal(prevented, true);
    await press(view, 'Next'); await act(async () => nav.handlers.get('beforeRemove')({ preventDefault() {}, data: { action: { type: 'GO_BACK' } } }));
    assert.equal(input(view, 'Activity title').props.value, 'Keep my draft');
    await act(async () => nav.handlers.get('beforeRemove')({ preventDefault() {}, data: { action: { type: 'GO_BACK' } } }));
    await press(view, 'Discard draft'); assert.deepEqual(nav.calls.at(-1), ['dispatch', { type: 'GO_BACK' }]); await unmount(view);
  });
  await t.test('geocoding failure cannot call the creation API and keeps the review retryable', async () => {
    apiCalls = []; const { view, nav } = await mount(); await toReview(view); geocodeFailure = true;
    try {
      await press(view, 'Publish plan'); assert.equal(apiCalls.length, 0); assert.deepEqual(nav.calls, []);
      assert.match(body(view), /Review your plan/); assert.match(body(view), /Coffee & conversation/);
      assert.match(body(view), /Could not post activity/); assert.equal(button(view, 'Publish plan').props.disabled, false);
    } finally { geocodeFailure = false; await unmount(view); }
  });
  await t.test('Publish revalidates a start time that expires while the review is open', async () => {
    apiCalls = []; const { view } = await mount(); await toReview(view);
    const originalNow = Date.now;
    try {
      Date.now = () => new Date(`${futureDate}T11:00:00`).getTime();
      await press(view, 'Publish plan');
      assert.match(body(view), /When is it happening/); assert.match(body(view), /must be in the future/);
      assert.equal(apiCalls.length, 0);
    } finally { Date.now = originalNow; await unmount(view); }
  });
  await t.test('missing authentication cannot publish an otherwise complete draft', async () => {
    apiCalls = []; token = null;
    try {
      const { view } = await mount(); await toReview(view); await press(view, 'Publish plan');
      assert.equal(apiCalls.length, 0); assert.equal(alerts.at(-1)[0], 'Unauthorized'); await unmount(view);
    } finally { token = 'auth-token'; }
  });
  await t.test('pristine Cancel exits safely and the existing half-hour picker retains 48 unique options', async () => {
    const { view, nav } = await mount(); await press(view, 'Cancel creation'); assert.deepEqual(nav.calls.at(-1), ['back']); await unmount(view);
    assert.equal(activityTimeOptions.length, 48); assert.equal(new Set(activityTimeOptions.map(option => option.value)).size, 48);
    assert.ok(activityTimeOptions.every(option => /^\d{2}:(00|30)$/.test(option.value)));
    assert.equal(activityTimeOptions[0].value, '00:00'); assert.equal(activityTimeOptions.at(-1).value, '23:30');
    let selected; let selector; await act(async () => { selector = create(React.createElement(ActivityTimeSelector, { label: 'Start time', value: '', onChange: value => { selected = value; } })); });
    await press(selector, 'Choose start time'); await press(selector, activityTimeOptions[21].label); assert.equal(selected, '10:30'); await unmount(selector);
  });
  await t.test('Android hardware back moves through steps and confirms discarding on the first step', async () => {
    platform = 'android';
    try {
      const { view, nav } = await mount(); await fill(view, 'Activity title', 'Android draft'); await press(view, 'Next');
      await act(async () => { assert.equal(hardwareBack(), true); });
      assert.equal(input(view, 'Activity title').props.value, 'Android draft'); assert.deepEqual(nav.calls, []);
      await act(async () => { assert.equal(hardwareBack(), true); });
      assert.match(body(view), /Discard this draft/); await press(view, 'Keep editing');
      assert.equal(input(view, 'Activity title').props.value, 'Android draft'); await unmount(view); assert.equal(hardwareBack, undefined);
    } finally { platform = 'web'; }
  });
  await t.test('selector dismissal and optional confirmation preserve wizard state, with real participant button presses', async () => {
    const { view } = await mount(); await toReview(view);
    await press(view, 'Edit participation'); const initial = Number(view.root.findByType(ParticipantStepper).props.value);
    await press(view, 'Increase participants'); assert.equal(view.root.findByType(ParticipantStepper).props.value, String(initial + 1));
    await press(view, 'Decrease participants'); assert.equal(view.root.findByType(ParticipantStepper).props.value, String(initial));
    await press(view, 'Private activity'); assert.equal(button(view, 'Private activity').props.accessibilitySelected, true);
    await press(view, 'Back'); await press(view, 'Choose activity date'); await press(view, 'Close');
    assert.equal(view.root.findByType(ActivityDateSelector).props.value, futureDate);
    await press(view, 'Choose start time'); await press(view, 'Close');
    assert.equal(view.root.findAllByType(ActivityTimeSelector)[0].props.value, '10:30');
    await press(view, 'Next'); await press(view, 'Next'); await press(view, 'More details');
    await press(view, 'Vibe'); await press(view, 'Active'); await press(view, 'Close vibe selector');
    await press(view, 'Vibe'); assert.equal(button(view, 'Laid-back').props.accessibilityState.checked, true); await press(view, 'Creative'); await press(view, 'Done');
    await press(view, 'Vibe'); assert.equal(button(view, 'Creative').props.accessibilityState.checked, true); await press(view, 'Close vibe selector');
    await press(view, 'Cost'); await press(view, 'Paid'); await fill(view, 'Cost in AUD', '15'); await press(view, 'Done');
    await press(view, 'Cost'); await fill(view, 'Cost in AUD', '999'); await press(view, 'Close cost selector');
    await press(view, 'Cost'); assert.equal(input(view, 'Cost in AUD').props.value, '15'); await press(view, 'Done');
    await press(view, 'Next'); await press(view, 'Next');
    assert.match(body(view), /Creative/); assert.match(body(view), /AUD 15/); assert.match(body(view), /Private activity/);
    await unmount(view);
  });
  await t.test('wide layout still presents one logical step at a time', async () => {
    width = 1440; const { view } = await mount(); assert.equal(view.root.findAllByType('Input').length, 1);
    await fill(view, 'Activity title', 'Desktop plan'); await press(view, 'Next'); assert.equal(view.root.findAllByType('Input').length, 0);
    assert.match(body(view), /2 of 8/); await unmount(view); width = 390;
  });
});
