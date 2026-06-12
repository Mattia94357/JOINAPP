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
const legalBaseUrl = process.env.LEGAL_BASE_URL || localEnv.LEGAL_BASE_URL || 'https://joinapp.app';

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      NSCameraUsageDescription: 'JOIN needs camera access so you can take a profile picture.',
      NSPhotoLibraryUsageDescription: 'JOIN needs access to your photos so you can upload a profile picture.',
      NSPhotoLibraryAddUsageDescription: 'JOIN needs access to your photos so you can upload a profile picture.',
    },
  },
  extra: {
    API_URL: apiUrl,
    LEGAL_BASE_URL: legalBaseUrl,
  },
});
