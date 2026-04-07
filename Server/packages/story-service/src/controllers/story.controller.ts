import { Request, Response } from 'express';
import { StoryService } from '../services/story.service';
import { CreateStorySchema, ReactSchema } from '../validators/story.validator';

export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  // POST /stories
  async createStory(req: Request, res: Response): Promise<void> {
    const parsed = CreateStorySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const story = await this.storyService.createStory({
      userId: req.user!.id,
      ...parsed.data,
    });
    res.status(201).json({ success: true, data: story });
  }

  // GET /stories/feed
  async getFeed(req: Request, res: Response): Promise<void> {
    // Gateway forwards x-following-ids header (comma-separated) set by user-service
    // For now we read from a query param; in production the feed service / gateway enriches this
    const raw = req.headers['x-following-ids'] as string | undefined
      ?? (req.query['followingIds'] as string | undefined)
      ?? '';
    const followingIds = raw ? raw.split(',').filter(Boolean) : [];

    const feed = await this.storyService.getFeed(followingIds);
    res.json({ success: true, data: feed });
  }

  // GET /stories/:id
  async getStory(req: Request, res: Response): Promise<void> {
    const story = await this.storyService.getStory(
      req.params.id,
      req.user?.id,
      req.user?.username,
    );
    res.json({ success: true, data: story });
  }

  // DELETE /stories/:id
  async deleteStory(req: Request, res: Response): Promise<void> {
    await this.storyService.deleteStory(req.params.id, req.user!.id);
    res.status(204).end();
  }

  // POST /stories/:id/react
  async reactToStory(req: Request, res: Response): Promise<void> {
    const parsed = ReactSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    await this.storyService.reactToStory(
      req.params.id,
      req.user!.id,
      req.user!.username,
      parsed.data.emoji,
    );
    res.json({ success: true });
  }

  // GET /stories/:id/viewers
  async getViewers(req: Request, res: Response): Promise<void> {
    const cursor = req.query.cursor as string | undefined;
    const limit  = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100);

    const result = await this.storyService.getViewers(
      req.params.id,
      req.user!.id,
      cursor,
      limit,
    );
    res.json({ success: true, data: result });
  }

  // GET /users/:userId/stories
  async getUserStories(req: Request, res: Response): Promise<void> {
    const stories = await this.storyService.getUserStories(req.params.userId);
    res.json({ success: true, data: stories });
  }
}
