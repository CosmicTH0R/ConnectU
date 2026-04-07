import 'dotenv/config';
import { Kafka } from 'kafkajs';
import { connectMongoDB, disconnectMongoDB } from '@instagram/shared';
import { createApp } from './app';

const PORT       = parseInt(process.env.PORT ?? '3004', 10);
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
const MONGO_URI  = process.env.MONGO_URI ?? 'mongodb://localhost:27017/instagram';

const kafka = new Kafka({
  clientId: 'story-service',
  brokers:  KAFKA_BROKERS,
});

async function main(): Promise<void> {
  await connectMongoDB(MONGO_URI);
  console.log('[story-service] MongoDB connected');

  const app    = createApp(kafka);
  const server = app.listen(PORT, () => {
    console.log(`[story-service] Listening on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[story-service] ${signal} received — shutting down…`);
    server.close(async () => {
      await disconnectMongoDB();
      console.log('[story-service] Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

main().catch(err => {
  console.error('[story-service] Fatal startup error:', err);
  process.exit(1);
});
