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
const apiUrl = process.env.EXPO_PUBLIC_API_URL || localEnv.EXPO_PUBLIC_API_URL;
const mapTilerApiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY || localEnv.EXPO_PUBLIC_MAPTILER_API_KEY;
const mapTilerMapStyle = process.env.EXPO_PUBLIC_MAPTILER_MAP_STYLE || localEnv.EXPO_PUBLIC_MAPTILER_MAP_STYLE;
const legalBaseUrl = process.env.LEGAL_BASE_URL || localEnv.LEGAL_BASE_URL;
const legalUrl = (key, path) => process.env[key] || localEnv[key] || (legalBaseUrl ? `${legalBaseUrl.replace(/\/$/, '')}/${path}` : undefined);

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      NSCameraUsageDescription: 'JOIN needs camera access so you can take a profile picture.',
      NSPhotoLibraryUsageDescription: 'JOIN needs photo library access so you can choose a profile picture.',
      NSPhotoLibraryAddUsageDescription: 'JOIN needs photo library access so you can choose a profile picture.',
      NSLocationWhenInUseUsageDescription: 'JOIN uses your location to center Map Mode on nearby activities.',
    },
  },
  extra: {
    API_URL: apiUrl,
    MAPTILER_API_KEY: mapTilerApiKey,
    MAPTILER_MAP_STYLE: mapTilerMapStyle || 'streets-v4-dark',
    PRIVACY_POLICY_URL: legalUrl('PRIVACY_POLICY_URL', 'privacy'),
    TERMS_URL: legalUrl('TERMS_URL', 'terms'),
    COMMUNITY_GUIDELINES_URL: legalUrl('COMMUNITY_GUIDELINES_URL', 'community-guidelines'),
    DELETE_ACCOUNT_URL: process.env.DELETE_ACCOUNT_URL || localEnv.DELETE_ACCOUNT_URL,
  },
});
