const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
require.extensions['.ts'] = compile;

const root = `${__dirname}/../src`;
const source = (path) => fs.readFileSync(`${root}/${path}`, 'utf8');
const home = source('screens/HomeScreen.tsx');
const map = source('screens/MapModeScreen.tsx');
const details = source('screens/ActivityScreen.tsx');
const profile = source('screens/ProfileScreen.tsx');
const publicProfile = source('screens/PublicProfileScreen.tsx');
const forgot = source('screens/ForgotPasswordScreen.tsx');

for (const [name, file] of [['Home', home], ['Map', map], ['Activity Details', details]]) {
  assert.doesNotMatch(file, /from ['"]\.\.\/utils\/curatedActivities['"]/, `${name} has no production curated fixture import`);
}
assert.doesNotMatch(home, /Showing curated plans|\.\.\.curatedActivities/);
assert.match(home, /Activities unavailable/);
assert.match(home, /Retry loading activities/);
assert.match(home, /No activities yet/);
assert.match(map, /Map activities could not be loaded/);
assert.match(map, /No activities to map yet/);
assert.doesNotMatch(details, /You joined this curated activity|getCuratedActivity/);
assert.doesNotMatch(details + profile + publicProfile, /Profile reviewed|Community Active/);
assert.match(details, /No reviews yet/);
assert.match(forgot, /__DEV__ && response\.data\.resetToken/);
assert.match(forgot, /__DEV__ && response\.data\.resetUrl/);

const { hasRealRating, ratingLabel } = require('../src/utils/rating');
assert.equal(hasRealRating(4.8, 0), false);
assert.equal(ratingLabel(4.8, 0), 'No reviews yet');
assert.equal(ratingLabel(undefined, undefined), 'No reviews yet');
assert.equal(hasRealRating(4.6, 3), true);
assert.equal(ratingLabel(4.6, 3), '4.6');

const { safeErrorMetadata, reportFrontendError } = require('../src/utils/safeError');
const sensitive = {
  name: 'AxiosError', code: 'ERR_BAD_REQUEST', message: 'password=PRIVATE_PASSWORD',
  config: { method: 'post', url: '/api/reset?token=PRIVATE_RESET_TOKEN', data: { inviteCode: 'PRIVATE_INVITE' }, headers: { Authorization: 'Bearer PRIVATE_JWT' } },
  response: { status: 400, data: { pushToken: 'PRIVATE_PUSH' }, headers: { 'x-request-id': 'safe-request-1' } },
};
const metadata = safeErrorMetadata(sensitive);
assert.deepEqual(metadata, { name: 'AxiosError', code: 'ERR_BAD_REQUEST', status: 400, method: 'POST', path: '/api/reset', requestId: 'safe-request-1' });
const originalWarn = console.warn; const calls = []; console.warn = (...args) => calls.push(args);
reportFrontendError('reset_failed', sensitive); console.warn = originalWarn;
const output = JSON.stringify(calls);
for (const secret of ['PRIVATE_PASSWORD', 'PRIVATE_RESET_TOKEN', 'PRIVATE_INVITE', 'PRIVATE_JWT', 'PRIVATE_PUSH']) assert.ok(!output.includes(secret));
assert.match(output, /safe-request-1/);

console.log('Production cleanup frontend tests passed.');
