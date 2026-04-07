import { Kafka, Producer, ProducerRecord, RecordMetadata } from 'kafkajs';
import { KafkaTopic } from '../constants';
import { KafkaEvent } from './events';
import { logger } from '../utils/logger';

export class KafkaProducer {
  private producer: Producer;
  private isConnected = false;

  constructor(protected readonly kafka: Kafka) {
    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30_000,
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    await this.producer.connect();
    this.isConnected = true;
    logger.info('Kafka producer connected');
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await this.producer.disconnect();
    this.isConnected = false;
    logger.info('Kafka producer disconnected');
  }

  async publish(topic: KafkaTopic, event: KafkaEvent): Promise<RecordMetadata[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    const record: ProducerRecord = {
      topic,
      messages: [
        {
          key: event.payload && 'userId' in event.payload
            ? String((event.payload as Record<string, unknown>).userId)
            : event.eventId,
          value: JSON.stringify(event),
          headers: {
            eventId: event.eventId,
            timestamp: event.timestamp,
            version: event.version,
          },
        },
      ],
    };

    try {
      const result = await this.producer.send(record);
      logger.debug(`Published event to ${topic}`, { eventId: event.eventId });
      return result;
    } catch (err) {
      logger.error(`Failed to publish event to ${topic}`, { err, eventId: event.eventId });
      throw err;
    }
  }

  async publishBatch(records: ProducerRecord[]): Promise<RecordMetadata[]> {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.producer.sendBatch({ topicMessages: records });
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let producerInstance: KafkaProducer | null = null;

export function createKafkaProducer(kafka: Kafka): KafkaProducer {
  if (!producerInstance) {
    producerInstance = new KafkaProducer(kafka);
  }
  return producerInstance;
}
