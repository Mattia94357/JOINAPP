import express from 'express';
import { body, validationResult } from 'express-validator';
import auth, { AuthRequest } from '../middleware/auth';
import Activity from '../models/Activity';

const router = express.Router();

router.get('/', async (req, res) => {
  const activities = await Activity.find().populate('host', 'name avatar').populate('participants', 'name avatar');
  res.json(activities);
});

router.post(
  '/',
  auth,
  body('title').notEmpty(),
  body('category').notEmpty(),
  body('location').notEmpty(),
  body('description').notEmpty(),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, category, location, description, date } = req.body;
    const activity = new Activity({
      title,
      category,
      location,
      description,
      date: date ? new Date(date) : new Date(),
      host: req.userId,
      participants: [req.userId],
    });

    await activity.save();
    res.status(201).json(activity);
  }
);

router.get('/:id', async (req, res) => {
  const activity = await Activity.findById(req.params.id).populate('host', 'name avatar').populate('participants', 'name avatar');
  if (!activity) return res.status(404).json({ message: 'Activity not found' });
  res.json(activity);
});

router.post('/:id/join', auth, async (req: AuthRequest, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Activity not found' });

  if (activity.participants.some((participant) => participant.toString() === req.userId)) {
    return res.status(400).json({ message: 'Already joined' });
  }

  activity.participants.push(req.userId as any);
  await activity.save();
  res.json(activity);
});

export default router;
