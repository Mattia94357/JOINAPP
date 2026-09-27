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
  if (!isDevelopment()) {
    const missing = missingCoreEnv();
    if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    const secret = process.env.JWT_SECRET || '';
    if (secret.length < 32 || /^(secret|changeme|password)$/i.test(secret)) {
      throw new Error('JWT_SECRET must be a unique value of at least 32 characters in production.');
    }
    if (process.env.IMAGE_STORAGE_PROVIDER !== 'cloudinary') {
      throw new Error('IMAGE_STORAGE_PROVIDER must be cloudinary in production.');
    }
    const missingImages = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter((key) => !process.env[key]);
    if (missingImages.length) throw new Error(`Missing required image storage variables: ${missingImages.join(', ')}`);
    validateConfiguredUrls();
  }
};
