import { Request, Response } from 'express';
import { HighlightService } from '../services/highlight.service';
import { CreateHighlightSchema, UpdateHighlightSchema } from '../validators/story.validator';

export class HighlightController {
  constructor(private readonly highlightService: HighlightService) {}

  // POST /highlights
  async createHighlight(req: Request, res: Response): Promise<void> {
    const parsed = CreateHighlightSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const highlight = await this.highlightService.createHighlight({
      userId: req.user!.id,
      ...parsed.data,
    });
    res.status(201).json({ success: true, data: highlight });
  }

  // GET /users/:userId/highlights
  async getUserHighlights(req: Request, res: Response): Promise<void> {
    const highlights = await this.highlightService.getUserHighlights(req.params.userId);
    res.json({ success: true, data: highlights });
  }

  // PUT /highlights/:id
  async updateHighlight(req: Request, res: Response): Promise<void> {
    const parsed = UpdateHighlightSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const highlight = await this.highlightService.updateHighlight(
      req.params.id,
      req.user!.id,
      parsed.data,
    );
    res.json({ success: true, data: highlight });
  }

  // DELETE /highlights/:id
  async deleteHighlight(req: Request, res: Response): Promise<void> {
    await this.highlightService.deleteHighlight(req.params.id, req.user!.id);
    res.status(204).end();
  }
}
