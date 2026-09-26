const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const originalLoad = Module._load;
let appStateListener; let focusCleanup; let intervalCallback; let intervalActive = false;
let calls = []; let refreshUnread = 0; let failInitial = false;
const refreshUnreadConversations = async () => { refreshUnread++; };
const message = (id, senderId, name, text, createdAt) => ({ id, sender: { id: senderId, name }, text, createdAt });
const initial = { id: 'chat', chatType: 'directPrivateChat', members: [{ id: 'u1', name: 'Same Name' }, { id: 'u2', name: 'Same Name' }],
  readOnly: false, messages: [message('one', 'u1', 'Same Name', 'mine', '2026-01-01T00:00:01Z')],
  nextCursor: 'older-cursor', latestCursor: 'latest-one', hasMore: true };
const incoming = { ...initial, messages: [message('one', 'u1', 'Same Name', 'mine', '2026-01-01T00:00:01Z'),
  message('two', 'u2', 'Same Name', 'incoming', '2026-01-01T00:00:02Z')], nextCursor: null, latestCursor: 'latest-two', hasMore: false };
const older = { ...initial, messages: [message('old', 'u2', 'Same Name', 'older', '2025-12-31T23:59:59Z')], nextCursor: null, hasMore: false };
const fetchChatRequest = async (_id, _token, cursor) => {
  calls.push(cursor || {}); if (failInitial && !cursor) throw Error('offline');
  if (cursor?.before) return { data: older };
  if (cursor?.after) return { data: incoming };
  return { data: initial };
};
Module._load = function(name, parent, main) {
  if (name === 'react-native') return {
    View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', KeyboardAvoidingView: 'Keyboard',
    ActivityIndicator: 'Spinner', Alert: { alert: () => {} }, Platform: { OS: 'web' },
    AppState: { currentState: 'active', addEventListener: (_event, listener) => { appStateListener = listener; return { remove: () => { appStateListener = undefined; } }; } },
    FlatList: (props) => React.createElement('List', props, props.ListHeaderComponent,
      props.data.map((item) => React.createElement(React.Fragment, { key: item.id }, props.renderItem({ item })) )),
    StyleSheet: { create: (styles) => styles },
  };
  if (name === '@react-navigation/native') return { useFocusEffect: (callback) => React.useEffect(() => { focusCleanup = callback(); return focusCleanup; }, [callback]) };
  if (name === 'react-native-safe-area-context') return { SafeAreaInsetsContext: React.createContext({ bottom: 0 }) };
  if (name === '@expo/vector-icons') return { Ionicons: () => null };
  if (name === '../context/AuthContext') return { useAuth: () => ({ token: 'token', user: { id: 'u1', name: 'Same Name' } }) };
  if (name === '../context/MessagingContext') return { useMessaging: () => ({ refreshUnreadConversations }) };
  if (name === '../api') return { fetchChatRequest, sendChatMessageRequest: async () => ({ data: { message: message('sent', 'u1', 'Same Name', 'sent', new Date().toISOString()) } }) };
  if (name.endsWith('/AvatarBadge') || name.endsWith('/BottomNavigation')) return { __esModule: true, default: () => null,
    BOTTOM_NAV_WEB_CONTENT_CLEARANCE: 0, getBottomNavigationClearance: () => 0 };
  return originalLoad.call(this, name, parent, main);
};
const realSetInterval = global.setInterval, realClearInterval = global.clearInterval;
global.setInterval = (fn) => { intervalCallback = fn; intervalActive = true; return 1; };
global.clearInterval = () => { intervalActive = false; };
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile; require.extensions['.ts'] = compile;
const ScreenModule = require('../src/screens/ChatScreen'); const Screen = ScreenModule.default;
const allText = (node) => typeof node === 'string' ? node : (Array.isArray(node) ? node : node?.children || []).map(allText).join(' ');
const flush = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  const props = { route: { params: { chatId: 'chat', title: 'Chat' } } };
  let view; await act(async () => { view = create(React.createElement(Screen, props)); await flush(); });
  assert.equal(intervalActive, true); assert.match(allText(view.toJSON()), /mine/);
  const rows = view.root.findAll((node) => node.props?.style && Array.isArray(node.props.style)
    && node.props.style.some((style) => style?.justifyContent === 'flex-end'));
  assert.ok(rows.length > 0, 'same-name current-user message uses sender ID for outgoing style');
  await act(async () => { intervalCallback(); await flush(); });
  assert.match(allText(view.toJSON()), /incoming/);
  assert.equal((allText(view.toJSON()).match(/mine/g) || []).length, 1, 'poll merge deduplicates messages');
  await act(async () => { appStateListener('active'); await flush(); });
  assert.ok(calls.filter((cursor) => cursor.after).length >= 2, 'activation refreshes after latest cursor');
  const olderButton = view.root.findByProps({ accessibilityLabel: 'Load older messages' });
  await act(async () => { olderButton.props.onPress(); await flush(); });
  assert.match(allText(view.toJSON()), /older/);
  const successfulRefreshes = refreshUnread;
  await act(async () => view.unmount());
  assert.equal(intervalActive, false); const callsAfterUnmount = calls.length;
  intervalCallback(); await flush(); assert.equal(calls.length, callsAfterUnmount, 'unfocused polling does not fetch');

  failInitial = true; calls = []; refreshUnread = successfulRefreshes;
  await act(async () => { view = create(React.createElement(Screen, props)); await flush(); });
  assert.match(allText(view.toJSON()), /Unable to load this chat/);
  assert.equal(refreshUnread, successfulRefreshes, 'failed retrieval does not refresh/clear unread state');
  await act(async () => view.unmount());

  const mapped = ScreenModule.mapChatMessages([message('a', 'u1', 'Same Name', 'a', '2026-01-01T00:00:00Z'),
    message('b', 'u2', 'Same Name', 'b', '2026-01-01T00:00:00Z')]);
  assert.equal(mapped[0].author, mapped[1].author); assert.notEqual(mapped[0].senderId, mapped[1].senderId);
  assert.equal(ScreenModule.mergeChatMessages(mapped, [mapped[0]]).length, 2);
  console.log('Messaging UI tests passed: polling focus/activation, older pages, ID ownership, failed reads, deduplication.');
})().finally(() => { global.setInterval = realSetInterval; global.clearInterval = realClearInterval; })
  .catch((error) => { console.error(error); process.exitCode = 1; });
