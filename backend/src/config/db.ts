import mongoose from 'mongoose';

const mongoErrorDetails = (error: unknown) => {
  const details: { name?: string; message?: string; code?: string | number } = {};

  if (error instanceof Error) {
    details.name = error.name;
    details.message = error.message;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' || typeof code === 'number') {
      details.code = code;
    }
  }

  return details;
};

const connectDb = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI must be configured.');
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('[db] MongoDB connection failed.');
    console.error('[db] MongoDB error details:', mongoErrorDetails(error));
    console.error('[db] Check MONGODB_URI, Atlas network access/IP whitelist, database user credentials, and VPN/firewall access.');
    console.error('[db] Password reset cannot work while MongoDB is unavailable because reset tokens are stored in MongoDB.');
    process.exit(1);
  }
};

export default connectDb;
