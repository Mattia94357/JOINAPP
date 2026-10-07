import { isMailConfigured, missingMailEnv } from './mail';
import { validateConfiguredUrls } from './urls';

const requiredCoreEnv = ['MONGODB_URI', 'JWT_SECRET', 'CORS_ORIGINS', 'PUBLIC_APP_URL', 'PASSWORD_RESET_BASE_URL'];

export const isDevelopment = () => process.env.NODE_ENV === 'development';

export const missingCoreEnv = () => requiredCoreEnv.filter((key) => !process.env[key]);

export const printStartupWarnings = () => {
  const missingCore = missingCoreEnv();
  const missingMail = missingMailEnv();

  if (missingCore.length) {
    console.warn(`[startup] Missing recommended env vars: ${missingCore.join(', ')}`);
  }

  if (!isMailConfigured()) {
    console.warn(`[startup] SMTP email is not configured. Missing: ${missingMail.join(', ')}`);
    console.warn('[startup] Password reset emails will not be sent until SMTP env vars are set.');
  }

  if (process.env.NODE_ENV !== 'production' && !process.env.NODE_ENV) {
    console.warn('[startup] NODE_ENV is not set. Development-only reset URLs will not be returned unless NODE_ENV=development.');
  }
};

export const assertProductionEnvironment = () => {
  if (!isDevelopment() && process.env.NODE_ENV !== 'production') return;
  if (process.env.IMAGE_UPLOADS_ENABLED && !['true', 'false'].includes(process.env.IMAGE_UPLOADS_ENABLED)) {
    throw new Error('IMAGE_UPLOADS_ENABLED must be true or false.');
  }
  for (const key of ['IMAGE_UPLOAD_DAILY_USER_LIMIT', 'IMAGE_UPLOAD_SHORT_WINDOW_LIMIT', 'IMAGE_UPLOAD_SHORT_WINDOW_MINUTES',
    'IMAGE_UPLOAD_IP_LIMIT', 'GLOBAL_DAILY_IMAGE_UPLOAD_LIMIT', 'IMAGE_ASSET_MAX_PER_USER', 'GLOBAL_DAILY_IMAGE_UPLOAD_BYTES']) {
    const value = process.env[key];
    if (value !== undefined && (!Number.isSafeInteger(Number(value)) || Number(value) < 1)) {
      throw new Error(`${key} must be a positive integer.`);
    }
  }
  if (!isDevelopment()) {
    const missing = missingCoreEnv();
    if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    const secret = process.env.JWT_SECRET || '';
    if (secret.length < 32 || /^(secret|changeme|password)$/i.test(secret)) {
      throw new Error('JWT_SECRET must be a unique value of at least 32 characters in production.');
    }
    if (process.env.IMAGE_STORAGE_PROVIDER !== 'r2') {
      throw new Error('IMAGE_STORAGE_PROVIDER must be r2 in production.');
    }
    const missingImages = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_BASE_URL']
      .filter((key) => !process.env[key]);
    if (missingImages.length) throw new Error(`Missing required image storage variables: ${missingImages.join(', ')}`);
    try {
      const publicImageUrl = new URL(process.env.R2_PUBLIC_BASE_URL as string);
      if (publicImageUrl.protocol !== 'https:') throw new Error();
    } catch {
      throw new Error('R2_PUBLIC_BASE_URL must be a valid HTTPS URL in production.');
    }
    validateConfiguredUrls();
  }
};
