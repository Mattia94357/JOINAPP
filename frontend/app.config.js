const fs = require('fs');
const path = require('path');

const readLocalEnv = () => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};

  return fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return values;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return values;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      values[key] = value;
      return values;
    }, {});
};

const localEnv = readLocalEnv();
const env = (key) => process.env[key] || localEnv[key];
const apiUrl = env('EXPO_PUBLIC_API_URL');
const publicAppUrl = env('EXPO_PUBLIC_APP_URL');
const projectId = env('EXPO_PUBLIC_EAS_PROJECT_ID');
const iosBundleIdentifier = env('EXPO_IOS_BUNDLE_IDENTIFIER');
const androidPackage = env('EXPO_ANDROID_PACKAGE');
const mapTilerApiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY || localEnv.EXPO_PUBLIC_MAPTILER_API_KEY;
const mapTilerMapStyle = process.env.EXPO_PUBLIC_MAPTILER_MAP_STYLE || localEnv.EXPO_PUBLIC_MAPTILER_MAP_STYLE;
const releaseProfile = ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE);
const httpsUrl = (key) => {
  const value = env(key);
  if (!value) return undefined;
  if (releaseProfile && !/^https:\/\//i.test(value)) throw new Error(`${key} must use HTTPS for preview and production builds.`);
  return value.replace(/\/$/, '');
};

if (releaseProfile) {
  const missing = [
    ['EXPO_PUBLIC_API_URL', apiUrl],
    ['EXPO_PUBLIC_APP_URL', publicAppUrl],
    ['EXPO_PUBLIC_EAS_PROJECT_ID', projectId],
    ['EXPO_IOS_BUNDLE_IDENTIFIER', iosBundleIdentifier],
    ['EXPO_ANDROID_PACKAGE', androidPackage],
    ['PRIVACY_POLICY_URL', env('PRIVACY_POLICY_URL')],
    ['TERMS_URL', env('TERMS_URL')],
    ['COMMUNITY_GUIDELINES_URL', env('COMMUNITY_GUIDELINES_URL')],
    ['SUPPORT_URL', env('SUPPORT_URL')],
    ['DELETE_ACCOUNT_URL', env('DELETE_ACCOUNT_URL')],
  ].filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing release configuration: ${missing.join(', ')}`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID must be the real EAS project UUID.');
  }
  if (!/^[A-Za-z][A-Za-z0-9.-]+$/.test(iosBundleIdentifier)) throw new Error('EXPO_IOS_BUNDLE_IDENTIFIER is invalid.');
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(androidPackage)) throw new Error('EXPO_ANDROID_PACKAGE is invalid.');
}

module.exports = ({ config }) => ({
  ...config,
  name: 'JOIN',
  scheme: 'join',
  plugins: [
    'expo-notifications',
    ['expo-image-picker', {
      photosPermission: 'JOIN lets you choose photos for your profile, activities, and Moments.',
      cameraPermission: 'JOIN lets you take photos for your profile, activities, and Moments.',
      microphonePermission: false,
    }],
  ],
  ios: {
    ...config.ios,
    ...(iosBundleIdentifier ? { bundleIdentifier: iosBundleIdentifier } : {}),
    infoPlist: {
      ...config.ios?.infoPlist,
      NSLocationWhenInUseUsageDescription: 'JOIN uses your location when you open Map Mode to show activities near you.',
    },
  },
  android: {
    ...config.android,
    ...(androidPackage ? { package: androidPackage } : {}),
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
  },
  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      projectId: projectId || config.extra?.eas?.projectId,
    },
    API_URL: httpsUrl('EXPO_PUBLIC_API_URL'),
    PUBLIC_APP_URL: httpsUrl('EXPO_PUBLIC_APP_URL'),
    MAPTILER_API_KEY: mapTilerApiKey,
    MAPTILER_MAP_STYLE: mapTilerMapStyle || 'streets-v4-dark',
    PRIVACY_POLICY_URL: httpsUrl('PRIVACY_POLICY_URL'),
    TERMS_URL: httpsUrl('TERMS_URL'),
    COMMUNITY_GUIDELINES_URL: httpsUrl('COMMUNITY_GUIDELINES_URL'),
    SUPPORT_URL: httpsUrl('SUPPORT_URL'),
    DELETE_ACCOUNT_URL: httpsUrl('DELETE_ACCOUNT_URL'),
  },
});
