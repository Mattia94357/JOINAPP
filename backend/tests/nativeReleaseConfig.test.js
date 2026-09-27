const assert = require('node:assert/strict');

process.env.NODE_ENV = 'production';
process.env.CORS_ORIGINS = 'https://app.example.test, https://preview.example.test';
process.env.PUBLIC_APP_URL = 'https://app.example.test';
process.env.PASSWORD_RESET_BASE_URL = 'https://auth.example.test';

const urls = require('../dist/config/urls');

assert.deepEqual(urls.allowedCorsOrigins(), ['https://app.example.test', 'https://preview.example.test']);
assert.equal(urls.publicAppUrl(), 'https://app.example.test');
assert.equal(urls.passwordResetBaseUrl(), 'https://auth.example.test');
assert.doesNotThrow(urls.validateConfiguredUrls);

process.env.CORS_ORIGINS = 'https://app.example.test/path';
assert.throws(urls.allowedCorsOrigins, /origins without a path/);
process.env.CORS_ORIGINS = 'http://app.example.test';
assert.throws(urls.allowedCorsOrigins, /HTTPS/);
process.env.CORS_ORIGINS = 'https://app.example.test';
process.env.PASSWORD_RESET_BASE_URL = 'http://localhost:19007';
assert.throws(urls.passwordResetBaseUrl, /HTTPS/);

console.log('Native release backend URL configuration tests passed.');
