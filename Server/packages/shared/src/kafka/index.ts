import { Kafka, logLevel } from 'kafkajs';

export * from './events';
export * from './producer';
export * from './consumer';

// ─── Shared Kafka client factory ──────────────────────────────────────────────

let kafkaInstance: Kafka | null = null;

export function getKafkaClient(): Kafka {
  if (!kafkaInstance) {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
    const clientId = process.env.KAFKA_CLIENT_ID ?? 'instagram-service';

    kafkaInstance = new Kafka({
      clientId,
      brokers,
      logLevel: process.env.NODE_ENV === 'production' ? logLevel.WARN : logLevel.INFO,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });
  }
  return kafkaInstance;
}
