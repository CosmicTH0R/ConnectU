import { Router } from 'express';
import { Kafka } from 'kafkajs';
import { authMiddleware } from '@instagram/shared';
import { StoryService } from '../services/story.service';
import { StoryController } from '../controllers/story.controller';
import { asyncHandler } from '../middleware/async-handler';

export function buildStoryRoutes(kafka: Kafka): Router {
  const service = new StoryService(kafka);
  const ctrl    = new StoryController(service);
  const router  = Router();

  // All story routes require auth
  router.use(authMiddleware);

  router.post  ('/',               asyncHandler(ctrl.createStory.bind(ctrl)));
  router.get   ('/feed',           asyncHandler(ctrl.getFeed.bind(ctrl)));
  router.get   ('/:id',            asyncHandler(ctrl.getStory.bind(ctrl)));
  router.delete('/:id',            asyncHandler(ctrl.deleteStory.bind(ctrl)));
  router.post  ('/:id/react',      asyncHandler(ctrl.reactToStory.bind(ctrl)));
  router.get   ('/:id/viewers',    asyncHandler(ctrl.getViewers.bind(ctrl)));

  return router;
}
