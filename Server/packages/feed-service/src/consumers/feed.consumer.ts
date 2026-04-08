import { Kafka } from 'kafkajs';
import { KafkaConsumer, KAFKA_TOPICS } from '@instagram/shared';
import type {
  PostCreatedEvent,
  PostDeletedEvent,
  FollowEvent,
  UnfollowEvent,
} from '@instagram/shared';
import type { FeedService } from '../services/feed.service';

export async function startFeedConsumer(
  kafka: Kafka,
  feedService: FeedService,
): Promise<KafkaConsumer> {
  const consumer = new KafkaConsumer(kafka, 'feed-service-group');

  await consumer.subscribe([
    {
      topic: KAFKA_TOPICS.POST_CREATED,
      handler: async (event) => {
        const { postId, userId, createdAt } = (event as PostCreatedEvent & { payload: { createdAt?: string } }).payload;
        const ts = createdAt ? new Date(createdAt).getTime() : Date.now();
        await feedService.fanOutPost(postId, userId, ts);
      },
    },
    {
      topic: KAFKA_TOPICS.POST_DELETED,
      handler: async (event) => {
        const { postId, userId } = (event as PostDeletedEvent).payload;
        await feedService.removePost(postId, userId);
      },
    },
    {
      topic: KAFKA_TOPICS.FOLLOW,
      handler: async (event) => {
        const { followerId, followingId } = (event as FollowEvent).payload;
        await feedService.recordFollow(followerId, followingId);
      },
    },
    {
      topic: KAFKA_TOPICS.UNFOLLOW,
      handler: async (event) => {
        const { followerId, followingId } = (event as UnfollowEvent).payload;
        await feedService.recordUnfollow(followerId, followingId);
      },
    },
  ]);

  return consumer;
}
