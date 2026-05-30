import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb+srv://mattiafonnesu:Bangtaophuket91!@joinapp.iqtd9dm.mongodb.net/';

const connectDb = async () => {
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDb;
