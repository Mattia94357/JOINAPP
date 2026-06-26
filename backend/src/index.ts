import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDb from './config/db';
import authRoutes from './routes/auth';
import activityRoutes from './routes/activities';
import chatRoutes from './routes/chats';
import userRoutes from './routes/users';
import { assertProductionEnvironment, printStartupWarnings } from './config/env';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

assertProductionEnvironment();
printStartupWarnings();
connectDb();

// Cloudflare Tunnel is the single trusted proxy in development deployments.
app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const developmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+)(:\d+)?$/;

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && developmentOrigin.test(origin))) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '6mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/chats', chatRoutes);

app.get('/', (req, res) => res.send({ message: 'JoinApp backend is up and running' }));

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
  if (error?.message === 'Origin is not allowed.') return res.status(403).json({ message: 'Origin is not allowed.' });
  if (process.env.NODE_ENV !== 'production') console.error('[server] Unexpected error', error);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
