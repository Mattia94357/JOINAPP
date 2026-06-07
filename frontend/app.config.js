export default ({ config }) => ({
  ...config,
  extra: {
    API_URL: process.env.API_URL ?? null,
    LEGAL_BASE_URL: process.env.LEGAL_BASE_URL ?? 'https://joinapp.app',
  },
});
