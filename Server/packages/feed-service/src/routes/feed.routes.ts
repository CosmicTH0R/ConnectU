import { Router } from 'express';
import { authMiddleware } from '@instagram/shared';
import { makeFeedController } from '../controllers/feed.controller';
import { asyncHandler } from '../middleware/async-handler';
import type { FeedService } from '../services/feed.service';

export function buildFeedRoutes(feedService: FeedService): Router {
  const router = Router();
  const ctrl = makeFeedController(feedService);

  router.use(authMiddleware);

  router.get('/',                asyncHandler(ctrl.getFeed));
  router.get('/explore',         asyncHandler(ctrl.getExploreFeed));
  router.get('/hashtag/:tag',    asyncHandler(ctrl.getHashtagFeed));
  router.post('/rebuild',        asyncHandler(ctrl.rebuildFeed));

  return router;
}
