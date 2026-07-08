import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { smtpErrorDetails } from '../config/mail';

dotenv.config();

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const logSafeConfig = () => {
  console.log('[smtp:test] config', {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    userExists: Boolean(smtpUser),
    passExists: Boolean(smtpPass),
  });
};

const main = async () => {
  logSafeConfig();

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('[smtp:test] verify fail', {
      message: 'SMTP_HOST, SMTP_USER, and SMTP_PASS are required for SMTP verify.',
    });
    process.exitCode = 1;
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  try {
    await transporter.verify();
    console.log('[smtp:test] verify success');
  } catch (error) {
    console.warn('[smtp:test] verify fail', smtpErrorDetails(error));
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.warn('[smtp:test] unexpected fail', smtpErrorDetails(error));
  process.exitCode = 1;
});
