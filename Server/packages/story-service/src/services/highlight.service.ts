import { Types } from 'mongoose';
import { Highlight, IHighlight } from '../models';

export interface CreateHighlightInput {
  userId: string;
  title: string;
  coverUrl?: string;
  storyIds: string[];
}

export class HighlightService {
  // ─── Create ────────────────────────────────────────────────────────────────

  async createHighlight(input: CreateHighlightInput): Promise<IHighlight> {
    const highlight = await Highlight.create({
      userId:   input.userId,
      title:    input.title,
      coverUrl: input.coverUrl,
      storyIds: input.storyIds.map(id => new Types.ObjectId(id)),
    });
    return highlight.toObject() as IHighlight;
  }

  // ─── List by user ─────────────────────────────────────────────────────────

  async getUserHighlights(userId: string): Promise<IHighlight[]> {
    return Highlight.find({ userId }).sort({ createdAt: -1 }).lean<IHighlight[]>();
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateHighlight(
    highlightId: string,
    userId: string,
    updates: { title?: string; coverUrl?: string },
  ): Promise<IHighlight> {
    const highlight = await Highlight.findById(highlightId);
    if (!highlight) throw Object.assign(new Error('Highlight not found'), { status: 404 });
    if (highlight.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    if (updates.title    !== undefined) highlight.title    = updates.title;
    if (updates.coverUrl !== undefined) highlight.coverUrl = updates.coverUrl;

    await highlight.save();
    return highlight.toObject() as IHighlight;
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteHighlight(highlightId: string, userId: string): Promise<void> {
    const highlight = await Highlight.findById(highlightId);
    if (!highlight) throw Object.assign(new Error('Highlight not found'), { status: 404 });
    if (highlight.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    await Highlight.deleteOne({ _id: highlightId });
  }
}
