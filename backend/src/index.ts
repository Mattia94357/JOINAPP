import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDb from './config/db';
import authRoutes from './routes/auth';
import activityRoutes from './routes/activities';
import chatRoutes from './routes/chats';
import userRoutes from './routes/users';
import { printStartupWarnings } from './config/env';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

printStartupWarnings();
connectDb();

app.use(cors());
app.use(express.json({ limit: '8mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/chats', chatRoutes);

app.get('/', (req, res) => res.send({ message: 'JoinApp backend is up and running' }));

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
