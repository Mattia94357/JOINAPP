const localWebUrl = 'http://localhost:19007';

const parseUrl = (name: string, value: string, options: { originOnly?: boolean; requireHttps?: boolean } = {}) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must contain a valid absolute URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${name} must use HTTP or HTTPS.`);
  if (options.requireHttps && parsed.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production.`);
  if (parsed.username || parsed.password) throw new Error(`${name} must not contain credentials.`);
  if (options.originOnly && (parsed.pathname !== '/' || parsed.search || parsed.hash)) {
    throw new Error(`${name} entries must be origins without a path, query, or fragment.`);
  }
  return options.originOnly ? parsed.origin : parsed.toString().replace(/\/$/, '');
};

const isProduction = () => process.env.NODE_ENV === 'production';

export const allowedCorsOrigins = () => {
  const raw = process.env.CORS_ORIGINS || (!isProduction() ? process.env.FRONTEND_URL : '') || '';
  return raw.split(',').map((value) => value.trim()).filter(Boolean)
    .map((value) => parseUrl('CORS_ORIGINS', value, { originOnly: true, requireHttps: isProduction() }));
};

export const publicAppUrl = () => {
  const value = process.env.PUBLIC_APP_URL || (!isProduction() ? process.env.FRONTEND_URL?.split(',')[0]?.trim() : '') || (!isProduction() ? localWebUrl : '');
  return value ? parseUrl('PUBLIC_APP_URL', value, { requireHttps: isProduction() }) : '';
};

export const passwordResetBaseUrl = () => {
  const value = process.env.PASSWORD_RESET_BASE_URL || (!isProduction() ? publicAppUrl() : '');
  return value ? parseUrl('PASSWORD_RESET_BASE_URL', value, { requireHttps: isProduction() }) : '';
};

export const validateConfiguredUrls = () => {
  allowedCorsOrigins();
  publicAppUrl();
  passwordResetBaseUrl();
};
