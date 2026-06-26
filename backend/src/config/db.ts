import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;

const connectDb = async () => {
  try {
    if (!uri) throw new Error('MONGODB_URI must be configured.');
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('[db] MongoDB connection failed.');
    console.error('[db] Check MONGODB_URI, Atlas network access/IP whitelist, database user credentials, and VPN/firewall access.');
    console.error('[db] Password reset cannot work while MongoDB is unavailable because reset tokens are stored in MongoDB.');
    if (process.env.NODE_ENV !== 'production') console.error(error);
    process.exit(1);
  }
};

export default connectDb;
