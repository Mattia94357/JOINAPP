import { errorHandler } from './middleware/errorHandler';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDb from './config/db';
import authRoutes from './routes/auth';
import reportRoutes from './routes/reports';
import activityRoutes from './routes/activities';
import chatRoutes from './routes/chats';
import userRoutes from './routes/users';
import momentRoutes from './routes/moments';
import notificationRoutes from './routes/notifications';
import pushDeviceRoutes from './routes/pushDevices';
import { startPushWorker } from './services/pushDelivery';
import { startNotificationWorker } from './services/notifications';
import { assertProductionEnvironment, printStartupWarnings } from './config/env';
import { localImageDirectory } from './services/imageStorage';
import { requestContext } from './middleware/requestContext';
import { allowedCorsOrigins } from './config/urls';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

assertProductionEnvironment();
printStartupWarnings();
connectDb().then(async () => { await startNotificationWorker(); await startPushWorker(); }).catch(() => {
  console.error('[notifications] Worker startup failed');
  process.exit(1);
});

// Render terminates TLS and forwards requests to this service.
app.set('trust proxy', 1);

const allowedOrigins = allowedCorsOrigins();
const developmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/;

app.disable('x-powered-by');
app.use(requestContext);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      (process.env.NODE_ENV !== 'production' && developmentOrigin.test(origin))
    ) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-ID'],
}));
app.use(express.json({ limit: '6mb' }));
if (process.env.NODE_ENV !== 'production' && process.env.IMAGE_STORAGE_PROVIDER === 'local') {
  app.use('/uploads', express.static(localImageDirectory(), { index: false, fallthrough: false }));
}
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } }));

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/moments', momentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push-devices', pushDeviceRoutes);

app.get('/', (req, res) => res.send({ message: 'JoinApp backend is up and running' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'JOIN API' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
