import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { isMailConfigured, sendPasswordResetEmail, smtpErrorDetails } from '../config/mail';
import { isDevelopment } from '../config/env';
import { getJwtSecret } from '../config/security';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
const resetTokenMinutes = 30;
const genericResetMessage = 'If an account exists, password reset instructions are on the way.';
const passwordStrengthMessage = 'Password must be at least 8 characters and include a letter and a number.';
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });

const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const isProduction = () => process.env.NODE_ENV === 'production';
const logAuthDebug = (message: string, error?: unknown) => {
  if (!isProduction()) {
    error ? console.warn(message, error) : console.log(message);
  }
};

const getFrontendUrl = () => {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (!isProduction()) return 'http://localhost:19007';
  return '';
};

const isStrongPassword = (password: string) => password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

const publicUserPayload = (user: any) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.profileThumbnailUrl || user.profilePictureUrl || user.avatar,
  profilePictureUrl: user.profilePictureUrl,
  profileThumbnailUrl: user.profileThumbnailUrl,
  pushToken: user.pushToken,
  profileCompleted: Boolean(user.profileCompleted || user.profilePictureUrl),
  location: user.location,
  interests: user.interests || [],
  verified: user.verified,
  bio: user.bio,
  aboutMe: user.aboutMe,
  languages: user.languages || [],
  instagram: user.instagram,
  ageRange: user.ageRange,
  hostRating: user.hostRating,
  activityRating: user.activityRating,
  reviewCount: user.reviewCount,
  hostedCount: user.hostedCount,
  joinedCount: user.joinedCount,
  savedActivities: user.savedActivities || [],
  hasCompletedOnboardingTutorial: Boolean(user.hasCompletedOnboardingTutorial),
  locationPublic: user.locationPublic,
  hostedActivitiesPublic: user.hostedActivitiesPublic,
  joinedActivitiesPublic: user.joinedActivitiesPublic,
});

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase();

router.post(
  '/register',
  authLimiter,
  body('name').isString().trim().isLength({ min: 2, max: 80 }),
  body('email').isEmail(),
  body('password').custom(isStrongPassword),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: passwordStrengthMessage });

    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1E1E1E&color=F4C542&size=128`;
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, avatar, profileCompleted: false });
    await user.save();

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: publicUserPayload(user) });
  }
);

router.post(
  '/forgot-password',
  authLimiter,
  body('email').isEmail(),
  async (req, res) => {
    logAuthDebug('[auth:forgot-password] Request received');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logAuthDebug('[auth:forgot-password] Invalid email submitted');
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email });

    if (!user) {
      logAuthDebug('[auth:forgot-password] User not found');
      return res.json({ message: genericResetMessage });
    }

    logAuthDebug('[auth:forgot-password] User found');
    const resetToken = crypto.randomBytes(32).toString('hex');
    logAuthDebug('[auth:forgot-password] Reset token generated');
    user.passwordResetTokenHash = hashResetToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + resetTokenMinutes * 60 * 1000);
    await user.save();
    logAuthDebug(`[auth:forgot-password] Reset token saved. Expires in ${resetTokenMinutes} minutes.`);

    const frontendUrl = getFrontendUrl();
    if (!frontendUrl) {
      console.warn('[auth:forgot-password] FRONTEND_URL missing in production.');
      return res.status(503).json({ message: 'Password reset is temporarily unavailable. Contact support.' });
    }
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      logAuthDebug(`[auth:forgot-password] Reset email send attempted. SMTP configured: ${isMailConfigured()}`);
      const sent = await sendPasswordResetEmail(user.email, resetUrl);
      logAuthDebug(`[auth:forgot-password] Reset email ${sent ? 'sent successfully' : 'not sent because SMTP is missing'}`);
      if (!sent && !isDevelopment()) {
        return res.status(503).json({ message: 'Password reset email is not configured. Contact support.' });
      }
      const devPayload = !sent && isDevelopment()
        ? {
            resetToken,
            resetUrl,
            mailConfigured: isMailConfigured(),
          }
        : {};
      return res.json({
        message: sent
          ? genericResetMessage
          : 'Email is not configured yet. Use the development reset link returned by the API.',
        ...devPayload,
      });
    } catch (error) {
      console.warn('[auth:forgot-password] Reset email send failed.', smtpErrorDetails(error));
      return res.status(500).json({ message: 'Unable to send reset email. Check mail server configuration.' });
    }
  }
);

router.post(
  '/reset-password',
  authLimiter,
  body('token').isString().notEmpty(),
  body('password').custom(isStrongPassword),
  async (req, res) => {
    logAuthDebug('[auth:reset-password] Request received');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logAuthDebug('[auth:reset-password] Invalid request payload');
      return res.status(400).json({ message: passwordStrengthMessage });
    }

    const { token, password } = req.body;
    const tokenHash = hashResetToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
    });

    if (!user) {
      logAuthDebug('[auth:reset-password] Invalid reset token');
      return res.status(400).json({ message: 'Reset token is invalid. Request a new password reset link.' });
    }

    if (!user.passwordResetExpires || user.passwordResetExpires <= new Date()) {
      logAuthDebug('[auth:reset-password] Expired reset token');
      return res.status(400).json({ message: 'Reset token has expired. Request a new password reset link.' });
    }

    logAuthDebug('[auth:reset-password] Reset token valid');
    user.password = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    logAuthDebug('[auth:reset-password] Password updated successfully. Reset token cleared.');

    res.json({ message: 'Password updated. You can now log in.' });
  }
);

router.post(
  '/login',
  authLimiter,
  body('email').isEmail(),
  body('password').exists(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { password } = req.body;
    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: publicUserPayload(user) });
  }
);

export default router;
