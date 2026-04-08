import { Request, Response } from 'express';
import { z } from 'zod';
import type { FeedService } from '../services/feed.service';

const PAGE_LIMIT = 20;

const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v ?? '20', 10) || PAGE_LIMIT, 50)),
});

export function makeFeedController(feedService: FeedService) {
  /**
   * GET /feed
   * Returns the current user's paginated home feed.
   */
  async function getFeed(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { cursor = null, limit } = CursorQuerySchema.parse(req.query);

    const page = await feedService.getFeed(userId, cursor, limit);
    res.json({ success: true, data: page.posts, nextCursor: page.nextCursor });
  }

  /**
   * GET /feed/explore
   * Returns posts from non-followed users ranked by engagement.
   */
  async function getExploreFeed(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { cursor = null, limit } = CursorQuerySchema.parse(req.query);

    const page = await feedService.getExploreFeed(userId, cursor, limit);
    res.json({ success: true, data: page.posts, nextCursor: page.nextCursor });
  }

  /**
   * GET /feed/hashtag/:tag
   * Proxied to post-service — feed-service does not index by hashtag.
   * This handler simply returns a 307 redirect to post-service via the gateway
   * or returns a not-implemented response if the caller hits this directly.
   */
  async function getHashtagFeed(req: Request, res: Response): Promise<void> {
    // Redirect to post-service endpoint (/posts?hashtag=:tag) via the same
    // request — since the gateway already proxies /posts, we just re-expose it.
    const tag = encodeURIComponent(req.params.tag ?? '');
    res.redirect(307, `/posts?hashtag=${tag}`);
  }

  /**
   * POST /feed/rebuild
   * Force-rebuilds the current user's feed from their following list.
   */
  async function rebuildFeed(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await feedService.rebuildFeed(userId);
    res.json({ success: true, message: `Feed rebuilt with ${result.rebuilt} posts` });
  }

  return { getFeed, getExploreFeed, getHashtagFeed, rebuildFeed };
}
