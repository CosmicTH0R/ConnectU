import { Router } from 'express';
import { authMiddleware } from '@instagram/shared';
import { HighlightService } from '../services/highlight.service';
import { HighlightController } from '../controllers/highlight.controller';
import { StoryController } from '../controllers/story.controller';
import { StoryService } from '../services/story.service';
import { asyncHandler } from '../middleware/async-handler';
import { Kafka } from 'kafkajs';

export function buildUserRoutes(kafka: Kafka): Router {
  const storyService    = new StoryService(kafka);
  const storyCtrl       = new StoryController(storyService);
  const highlightCtrl   = new HighlightController(new HighlightService());
  const router          = Router();

  router.use(authMiddleware);

  // GET /users/:userId/stories
  router.get('/:userId/stories',    asyncHandler(storyCtrl.getUserStories.bind(storyCtrl)));
  // GET /users/:userId/highlights
  router.get('/:userId/highlights', asyncHandler(highlightCtrl.getUserHighlights.bind(highlightCtrl)));

  return router;
}

export function buildHighlightRoutes(): Router {
  const router = Router();

  router.use(authMiddleware);

  const ctrl = new HighlightController(new HighlightService());
  router.post  ('/',   asyncHandler(ctrl.createHighlight.bind(ctrl)));
  router.put   ('/:id', asyncHandler(ctrl.updateHighlight.bind(ctrl)));
  router.delete('/:id', asyncHandler(ctrl.deleteHighlight.bind(ctrl)));

  return router;
}
