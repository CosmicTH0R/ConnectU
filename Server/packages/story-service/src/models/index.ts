import { Schema, model, Document, Types } from 'mongoose';

// ─── Story ────────────────────────────────────────────────────────────────────

export interface IStory extends Document {
  userId: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType: 'image' | 'video';
  caption?: string;
  audience: 'public' | 'followers' | 'close_friends';
  viewerCount: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StorySchema = new Schema<IStory>(
  {
    userId:       { type: String, required: true, index: true },
    mediaUrl:     { type: String, required: true },
    thumbnailUrl: { type: String },
    mediaType:    { type: String, enum: ['image', 'video'], required: true },
    caption:      { type: String, maxlength: 2200 },
    audience:     { type: String, enum: ['public', 'followers', 'close_friends'], default: 'followers' },
    viewerCount:  { type: Number, default: 0 },
    expiresAt:    { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // MongoDB TTL index
  },
  { timestamps: true },
);

StorySchema.index({ userId: 1, createdAt: -1 });

export const Story = model<IStory>('Story', StorySchema);

// ─── StoryView ────────────────────────────────────────────────────────────────

export interface IStoryView extends Document {
  storyId: Types.ObjectId;
  viewerId: string;
  viewedAt: Date;
}

const StoryViewSchema = new Schema<IStoryView>({
  storyId:  { type: Schema.Types.ObjectId, ref: 'Story', required: true },
  viewerId: { type: String, required: true },
  viewedAt: { type: Date, default: Date.now, index: { expireAfterSeconds: 86400 } }, // 24h TTL
});

StoryViewSchema.index({ storyId: 1, viewerId: 1 }, { unique: true });
StoryViewSchema.index({ storyId: 1, viewedAt: -1 });

export const StoryView = model<IStoryView>('StoryView', StoryViewSchema);

// ─── StoryReaction ────────────────────────────────────────────────────────────

export interface IStoryReaction extends Document {
  storyId: Types.ObjectId;
  userId: string;
  emoji: string;
  createdAt: Date;
}

const StoryReactionSchema = new Schema<IStoryReaction>(
  {
    storyId: { type: Schema.Types.ObjectId, ref: 'Story', required: true },
    userId:  { type: String, required: true },
    emoji:   { type: String, required: true, maxlength: 8 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

StoryReactionSchema.index({ storyId: 1, userId: 1 }, { unique: true });
StoryReactionSchema.index({ storyId: 1, createdAt: -1 });

export const StoryReaction = model<IStoryReaction>('StoryReaction', StoryReactionSchema);

// ─── Highlight ────────────────────────────────────────────────────────────────

export interface IHighlight extends Document {
  userId: string;
  title: string;
  coverUrl?: string;
  storyIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const HighlightSchema = new Schema<IHighlight>(
  {
    userId:   { type: String, required: true, index: true },
    title:    { type: String, required: true, maxlength: 100 },
    coverUrl: { type: String },
    storyIds: [{ type: Schema.Types.ObjectId }],
  },
  { timestamps: true },
);

export const Highlight = model<IHighlight>('Highlight', HighlightSchema);
