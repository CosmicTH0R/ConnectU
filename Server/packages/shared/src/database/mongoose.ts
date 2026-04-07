import mongoose from 'mongoose';
import { logger } from '../utils/logger';

let isConnected = false;

export async function connectMongoDB(uri?: string): Promise<void> {
  if (isConnected) return;

  const mongoUri = uri ?? process.env.MONGO_URI ?? 'mongodb://localhost:27017/instagram';

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
    isConnected = true;
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error('MongoDB connection error', { err: err.message });
    isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
    isConnected = false;
  });

  await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 45_000,
    connectTimeoutMS: 10_000,
  });
}

export async function disconnectMongoDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected gracefully');
}

export { mongoose };
