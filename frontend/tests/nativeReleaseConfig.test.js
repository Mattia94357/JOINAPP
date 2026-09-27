const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const appJson = require('../app.json').expo;
const eas = require('../eas.json');

const releaseEnv = {
  EAS_BUILD_PROFILE: 'preview',
  EXPO_PUBLIC_API_URL: 'https://api.example.test',
  EXPO_PUBLIC_APP_URL: 'https://app.example.test',
  EXPO_PUBLIC_EAS_PROJECT_ID: '123e4567-e89b-42d3-a456-426614174000',
  EXPO_IOS_BUNDLE_IDENTIFIER: 'test.example.join',
  EXPO_ANDROID_PACKAGE: 'test.example.join',
  PRIVACY_POLICY_URL: 'https://app.example.test/privacy',
  TERMS_URL: 'https://app.example.test/terms',
  COMMUNITY_GUIDELINES_URL: 'https://app.example.test/community',
  SUPPORT_URL: 'https://app.example.test/support',
  DELETE_ACCOUNT_URL: 'https://app.example.test/delete-account',
};
Object.assign(process.env, releaseEnv);

const configFactory = require('../app.config.js');
const config = configFactory({ config: appJson });
assert.equal(config.name, 'JOIN');
assert.equal(config.scheme, 'join');
assert.equal(config.ios.bundleIdentifier, releaseEnv.EXPO_IOS_BUNDLE_IDENTIFIER);
assert.equal(config.android.package, releaseEnv.EXPO_ANDROID_PACKAGE);
assert.equal(config.extra.eas.projectId, releaseEnv.EXPO_PUBLIC_EAS_PROJECT_ID);
assert.equal(config.extra.API_URL, releaseEnv.EXPO_PUBLIC_API_URL);
assert.equal(config.extra.SUPPORT_URL, releaseEnv.SUPPORT_URL);
assert(config.plugins.some((plugin) => plugin === 'expo-notifications'));
assert(config.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker' && plugin[1].microphonePermission === false));
assert(!config.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location'), 'SDK 48 location plugin adds unused always/foreground-service declarations');
assert.deepEqual(config.android.permissions, ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']);
assert.match(config.ios.infoPlist.NSLocationWhenInUseUsageDescription, /Map Mode/);
assert.equal(eas.build.preview.distribution, 'internal');
assert.equal(eas.build.production.distribution, 'store');
assert.equal(eas.build.production.autoIncrement, true);

const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
const apiSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'api.ts'), 'utf8');
assert.match(appSource, /'join:\/\/'/);
assert.match(appSource, /PUBLIC_APP_URL/);
assert.doesNotMatch(appSource, /joinapp\.app/);
assert.equal((appSource.match(/name="Activity"/g) || []).length, 2, 'Activity links must resolve before and after authentication');
assert.equal((appSource.match(/name="ResetPassword"/g) || []).length, 2, 'Reset links must resolve before and after authentication');
assert.match(appSource, /pendingActivityRef/);
assert.match(apiSource, /public HTTPS URL for production builds/);
assert.match(apiSource, /privateHost/);

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4000';
assert.throws(() => configFactory({ config: appJson }), /HTTPS/);

console.log('Native release frontend configuration tests passed.');
