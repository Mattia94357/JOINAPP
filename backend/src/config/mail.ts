import nodemailer from 'nodemailer';

const requiredMailEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];

export const isMailConfigured = () => requiredMailEnv.every((key) => Boolean(process.env[key]));

export const missingMailEnv = () => requiredMailEnv.filter((key) => !process.env[key]);

export const sendPasswordResetEmail = async (to: string, resetUrl: string) => {
  if (!isMailConfigured()) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'JOIN <no-reply@joinapp.local>',
    to,
    subject: 'Reset your JOIN password',
    text: [
      'We received a request to reset your JOIN password.',
      '',
      `Reset your password here: ${resetUrl}`,
      '',
      'This link expires in 30 minutes. If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="background:#0D0D0D;color:#FFFFFF;font-family:Arial,sans-serif;padding:32px">
        <div style="max-width:520px;margin:0 auto;background:#1E1E1E;border:1px solid #2B2B2B;border-radius:12px;padding:28px">
          <h1 style="margin:0 0 12px;font-size:24px">Reset your JOIN password</h1>
          <p style="color:#B3B3B3;line-height:1.5">We received a request to reset your password. This link expires in 30 minutes.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#F4C542;color:#0D0D0D;text-decoration:none;font-weight:800;padding:14px 18px;border-radius:8px;margin-top:12px">Reset password</a>
          <p style="color:#7A7A7A;font-size:12px;line-height:1.5;margin-top:24px">If you did not request this, you can ignore this email.</p>
        </div>
      </div>
    `,
  });

  return true;
};
