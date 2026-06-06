import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { isMailConfigured, sendPasswordResetEmail } from '../config/mail';
import { isDevelopment } from '../config/env';

const router = express.Router();
const resetTokenMinutes = 30;
const genericResetMessage = 'If an account exists, password reset instructions are on the way.';
const passwordStrengthMessage = 'Password must be at least 8 characters and include a letter and a number.';

const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:19007';

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
  nationality: user.nationality,
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

router.post(
  '/register',
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1E1E1E&color=F4C542&size=128`;
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, avatar, profileCompleted: false });
    await user.save();

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: publicUserPayload(user) });
  }
);

router.post(
  '/forgot-password',
  body('email').isEmail(),
  async (req, res) => {
    console.log('[auth:forgot-password] Request received');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('[auth:forgot-password] Invalid email submitted');
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const { email } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase() });

    if (!user) {
      console.log('[auth:forgot-password] User not found');
      return res.json({ message: genericResetMessage });
    }

    console.log(`[auth:forgot-password] User found: ${user.id}`);
    const resetToken = crypto.randomBytes(32).toString('hex');
    console.log('[auth:forgot-password] Reset token generated');
    user.passwordResetTokenHash = hashResetToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + resetTokenMinutes * 60 * 1000);
    await user.save();
    console.log(`[auth:forgot-password] Reset token saved to MongoDB. Expires in ${resetTokenMinutes} minutes.`);

    const resetUrl = `${getFrontendUrl()}/reset-password?token=${resetToken}`;

    try {
      console.log(`[auth:forgot-password] Reset email send attempted. SMTP configured: ${isMailConfigured()}`);
      const sent = await sendPasswordResetEmail(user.email, resetUrl);
      console.log(`[auth:forgot-password] Reset email ${sent ? 'sent successfully' : 'not sent because SMTP is missing'}`);
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
      console.error('[auth:forgot-password] Reset email send failed', error);
      return res.status(500).json({ message: 'Unable to send reset email. Check mail server configuration.' });
    }
  }
);

router.post(
  '/reset-password',
  body('token').isString().notEmpty(),
  body('password').custom(isStrongPassword),
  async (req, res) => {
    console.log('[auth:reset-password] Request received');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('[auth:reset-password] Invalid request payload');
      return res.status(400).json({ message: passwordStrengthMessage });
    }

    const { token, password } = req.body;
    const tokenHash = hashResetToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
    });

    if (!user) {
      console.warn('[auth:reset-password] Invalid reset token');
      return res.status(400).json({ message: 'Reset token is invalid. Request a new password reset link.' });
    }

    if (!user.passwordResetExpires || user.passwordResetExpires <= new Date()) {
      console.warn(`[auth:reset-password] Expired reset token for user: ${user.id}`);
      return res.status(400).json({ message: 'Reset token has expired. Request a new password reset link.' });
    }

    console.log(`[auth:reset-password] Reset token valid for user: ${user.id}`);
    user.password = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    console.log(`[auth:reset-password] Password updated successfully for user: ${user.id}. Reset token cleared.`);

    res.json({ message: 'Password updated. You can now log in.' });
  }
);

router.post(
  '/login',
  body('email').isEmail(),
  body('password').exists(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: publicUserPayload(user) });
  }
);

export default router;
