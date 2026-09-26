const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const originalLoad = Module._load;
let fail = false; let submitted; const alerts = [];
const localImages = [{ uri: 'file:///prepared-one.jpg' }];
Module._load = function(name, parent, main) {
  if (name === 'react-native') return {
    View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', Image: 'Image', ScrollView: 'ScrollView',
    Modal: (props) => props.visible ? React.createElement('Modal', props, props.children) : null,
    ActivityIndicator: 'Spinner', Alert: { alert: (...args) => alerts.push(args) }, StyleSheet: { create: (styles) => styles },
  };
  if (name === '@expo/vector-icons') return { Ionicons: () => null };
  if (name === 'expo-crypto') return { randomUUID: () => 'stable-draft-id' };
  if (name === '../utils/momentMedia') return { MAX_MOMENT_IMAGES: 3, pickMomentImages: async () => localImages,
    encodeMomentImagesForUpload: async (images) => { assert.deepEqual(images, localImages); return ['data:image/jpeg;base64,ENCODED_ONLY_DURING_SUBMIT']; } };
  if (name === '../api') return { createMomentRequest: async (...args) => { submitted = args; if (fail) throw { response: { data: { message: 'Provider unavailable' } } };
    return { data: { id: 'moment', images: ['https://cdn.example.test/moment.jpg'], creator: {}, activity: {}, likeCount: 0, likedByViewer: false, commentCount: 0, latestComments: [], canDelete: true, createdAt: '', updatedAt: '' } }; } };
  if (name.endsWith('/theme')) return { colors: new Proxy({}, { get: () => '#000' }), spacing: { xs: 4, sm: 8, md: 16, lg: 24 } };
  return originalLoad.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.tsx'] = compile; require.extensions['.ts'] = compile;
const CreateMomentModal = require('../src/components/CreateMomentModal').default;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const text = (node) => typeof node === 'string' ? node : (Array.isArray(node) ? node : node?.children || []).map(text).join(' ');
const button = (view, label) => view.root.findAllByType('Button').find((node) => text(node).includes(label));

(async () => {
  const created = []; let closed = 0;
  let view; await act(async () => { view = create(React.createElement(CreateMomentModal, { visible: true, activityId: 'a', activityTitle: 'Plan', token: 't',
    onClose: () => { closed++; }, onCreated: (moment) => created.push(moment) })); });
  await act(async () => { button(view, 'Choose activity photos').props.onPress(); await flush(); });
  assert.equal(view.root.findByType('Image').props.source.uri, 'file:///prepared-one.jpg', 'preview state retains only a local URI');
  assert.ok(!JSON.stringify(view.toJSON()).includes('base64'), 'base64 is not persisted in rendered component state');
  await act(async () => { button(view, 'Add Moment').props.onPress(); await flush(); });
  assert.equal(submitted[1][0], 'data:image/jpeg;base64,ENCODED_ONLY_DURING_SUBMIT');
  assert.equal(submitted[4], 'stable-draft-id');
  assert.equal(created[0].images[0], 'https://cdn.example.test/moment.jpg', 'successful UI update uses provider URL');
  assert.equal(closed, 1);

  fail = true; submitted = undefined;
  await act(async () => { button(view, 'Choose activity photos').props.onPress(); await flush(); });
  await act(async () => { button(view, 'Add Moment').props.onPress(); await flush(); });
  assert.equal(alerts.at(-1)[1], 'Provider unavailable');
  assert.equal(view.root.findByType('Image').props.source.uri, 'file:///prepared-one.jpg', 'failed upload retains retryable local preview');
  assert.ok(!JSON.stringify(view.toJSON()).includes('ENCODED_ONLY_DURING_SUBMIT'));

  const profileSource = fs.readFileSync(require.resolve('../src/screens/ProfileScreen.tsx'), 'utf8');
  assert.match(profileSource, /await updateUser\(response\.data\)/, 'profile success immediately adopts returned provider URLs');
  assert.match(profileSource, /finally\s*\{\s*setUploading\(false\)/, 'profile failure clears loading state');
  assert.doesNotMatch(profileSource, /useState[^\n]*base64/i, 'profile base64 is not persisted in React state');
  console.log('Frontend image upload tests passed.');
})().finally(() => { Module._load = originalLoad; }).catch((error) => { console.error(error); process.exitCode = 1; });
