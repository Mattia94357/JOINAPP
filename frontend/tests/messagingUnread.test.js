const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const originalLoad = Module._load;
let session = { token: 'token-one', user: { id: 'one' } };
const requests = [];
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
Module._load = function(name, parent, main) {
  if (name === 'react-native') return { AppState: { addEventListener: () => ({ remove: () => {} }) } };
  if (name === './AuthContext') return { useAuth: () => session };
  if (name === '../api') return { fetchUnreadConversationCountRequest: (token) => {
    const request = deferred(); requests.push({ token, ...request }); return request.promise;
  } };
  return originalLoad.call(this, name, parent, main);
};
const realSetInterval = global.setInterval; const realClearInterval = global.clearInterval;
global.setInterval = () => 1; global.clearInterval = () => {};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile; require.extensions['.ts'] = compile;
const { MessagingProvider, useMessaging } = require('../src/context/MessagingContext');
const Value = () => { const value = useMessaging(); return React.createElement('Value', { counts: `${value.unreadConversationCount}:${value.unreadRequestCount}` }); };
const Tree = () => React.createElement(MessagingProvider, null, React.createElement(Value));
const flush = () => new Promise((resolve) => setImmediate(resolve));
(async () => {
  let view; await act(async () => { view = create(React.createElement(Tree)); await flush(); });
  assert.equal(requests[0].token, 'token-one');
  session = { token: 'token-two', user: { id: 'two' } };
  await act(async () => { view.update(React.createElement(Tree)); await flush(); });
  assert.equal(requests[1].token, 'token-two');
  await act(async () => { requests[1].resolve({ data: { unreadConversationCount: 7, unreadRequestCount: 2 } }); await flush(); });
  assert.equal(view.root.findByType('Value').props.counts, '7:2');
  await act(async () => { requests[0].resolve({ data: { unreadConversationCount: 99, unreadRequestCount: 99 } }); await flush(); });
  assert.equal(view.root.findByType('Value').props.counts, '7:2', 'old account response cannot overwrite new account counts');
  session = { token: null, user: null };
  await act(async () => { view.update(React.createElement(Tree)); await flush(); });
  assert.equal(view.root.findByType('Value').props.counts, '0:0');
  await act(async () => view.unmount());
  console.log('Messaging unread session guard test passed.');
})().finally(() => { global.setInterval = realSetInterval; global.clearInterval = realClearInterval; })
  .catch((error) => { console.error(error); process.exitCode = 1; });
