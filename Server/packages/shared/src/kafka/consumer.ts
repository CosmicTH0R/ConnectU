import {
  Consumer,
  EachMessagePayload,
  Kafka,
  KafkaMessage,
} from 'kafkajs';
import { KafkaTopic } from '../constants';
import { KafkaEvent } from './events';
import { logger } from '../utils/logger';

export type MessageHandler<T extends KafkaEvent = KafkaEvent> = (
  event: T,
  rawMessage: KafkaMessage,
) => Promise<void>;

export interface TopicHandler {
  topic: KafkaTopic;
  handler: MessageHandler;
}

export class KafkaConsumer {
  private consumer: Consumer;
  private isConnected = false;

  constructor(
    protected readonly kafka: Kafka,
    private readonly groupId: string,
  ) {
    this.consumer = kafka.consumer({
      groupId,
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
      maxWaitTimeInMs: 5_000,
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    await this.consumer.connect();
    this.isConnected = true;
    logger.info(`Kafka consumer connected (group: ${this.groupId})`);
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await this.consumer.disconnect();
    this.isConnected = false;
    logger.info(`Kafka consumer disconnected (group: ${this.groupId})`);
  }

  async subscribe(handlers: TopicHandler[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const topics = handlers.map((h) => h.topic);
    const handlerMap = new Map<string, MessageHandler>(
      handlers.map((h) => [h.topic, h.handler]),
    );

    await this.consumer.subscribe({ topics, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, message }: EachMessagePayload) => {
        const handler = handlerMap.get(topic);
        if (!handler) return;

        if (!message.value) {
          logger.warn(`Received empty message on topic ${topic}`);
          return;
        }

        try {
          const event = JSON.parse(message.value.toString()) as KafkaEvent;
          await handler(event, message);
        } catch (err) {
          logger.error(`Error processing message on topic ${topic}`, {
            err,
            offset: message.offset,
          });
          // Do not rethrow — allow Kafka to continue processing
        }
      },
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createKafkaConsumer(kafka: Kafka, groupId: string): KafkaConsumer {
  return new KafkaConsumer(kafka, groupId);
}
