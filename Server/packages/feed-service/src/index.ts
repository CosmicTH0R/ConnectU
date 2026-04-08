import 'dotenv/config';
import { Kafka } from 'kafkajs';
import { closeRedisClient } from '@instagram/shared';
import { createApp } from './app';
import { startFeedConsumer } from './consumers/feed.consumer';

const PORT          = parseInt(process.env.PORT ?? '3003', 10);
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');

const kafka = new Kafka({
  clientId: 'feed-service',
  brokers:  KAFKA_BROKERS,
});

async function main(): Promise<void> {
  const { app, feedService } = createApp();

  // Start Kafka consumer
  const consumer = await startFeedConsumer(kafka, feedService);

  const server = app.listen(PORT, () => {
    console.log(`[feed-service] Listening on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[feed-service] ${signal} received — shutting down…`);
    server.close(async () => {
      await consumer.disconnect();
      await closeRedisClient();
      console.log('[feed-service] Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[feed-service] Fatal startup error:', err);
  process.exit(1);
});
