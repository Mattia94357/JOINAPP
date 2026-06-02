import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb+srv://mattiafonnesu:Bangtaophuket91!@joinapp.iqtd9dm.mongodb.net/';

const connectDb = async () => {
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('[db] MongoDB connection failed.');
    console.error('[db] Check MONGODB_URI, Atlas network access/IP whitelist, database user credentials, and VPN/firewall access.');
    console.error('[db] Password reset cannot work while MongoDB is unavailable because reset tokens are stored in MongoDB.');
    console.error(error);
    process.exit(1);
  }
};

export default connectDb;
