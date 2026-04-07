import { Request, Response } from 'express';
import { PostService } from '../services/post.service';
import { LikeService } from '../services/like.service';
import { CommentService } from '../services/comment.service';
import { SaveService } from '../services/save.service';
import {
  CreatePostSchema,
  UpdatePostSchema,
  CreateCommentSchema,
  PaginationSchema,
  HashtagQuerySchema,
} from '../validators/post.validator';

const postService    = new PostService();
const likeService    = new LikeService();
const commentService = new CommentService();
const saveService    = new SaveService();

// ─── Post CRUD ────────────────────────────────────────────────────────────────

export async function createPost(req: Request, res: Response): Promise<void> {
  const parsed = CreatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const post = await postService.createPost(req.user!.id, parsed.data);
  res.status(201).json({ success: true, data: post });
}

export async function getPost(req: Request, res: Response): Promise<void> {
  const post = await postService.getPost(req.params.id!);
  res.status(200).json({ success: true, data: post });
}

export async function updatePost(req: Request, res: Response): Promise<void> {
  const parsed = UpdatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const post = await postService.updatePost(req.params.id!, req.user!.id, parsed.data);
  res.status(200).json({ success: true, data: post });
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  await postService.deletePost(req.params.id!, req.user!.id);
  res.status(200).json({ success: true, message: 'Post deleted' });
}

export async function getUserPosts(req: Request, res: Response): Promise<void> {
  const pagination = PaginationSchema.parse(req.query);
  const result = await postService.getUserPosts(req.params.userId!, pagination);
  res.status(200).json({ success: true, data: result });
}

export async function getPostsByHashtag(req: Request, res: Response): Promise<void> {
  const query = HashtagQuerySchema.parse(req.query);
  const result = await postService.getPostsByHashtag(query);
  res.status(200).json({ success: true, data: result });
}

// ─── Like ─────────────────────────────────────────────────────────────────────

export async function likePost(req: Request, res: Response): Promise<void> {
  await likeService.likePost(req.params.id!, req.user!.id, req.user!.username);
  res.status(200).json({ success: true, message: 'Post liked' });
}

export async function unlikePost(req: Request, res: Response): Promise<void> {
  await likeService.unlikePost(req.params.id!, req.user!.id);
  res.status(200).json({ success: true, message: 'Post unliked' });
}

export async function getLikes(req: Request, res: Response): Promise<void> {
  const pagination = PaginationSchema.parse(req.query);
  const result = await likeService.getLikes(req.params.id!, pagination);
  res.status(200).json({ success: true, data: result });
}

// ─── Comment ──────────────────────────────────────────────────────────────────

export async function addComment(req: Request, res: Response): Promise<void> {
  const parsed = CreateCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const comment = await commentService.addComment(req.params.id!, req.user!.id, req.user!.username, parsed.data);
  res.status(201).json({ success: true, data: comment });
}

export async function getComments(req: Request, res: Response): Promise<void> {
  const pagination = PaginationSchema.parse(req.query);
  const result = await commentService.getComments(req.params.id!, pagination);
  res.status(200).json({ success: true, data: result });
}

export async function getCommentReplies(req: Request, res: Response): Promise<void> {
  const pagination = PaginationSchema.parse(req.query);
  const result = await commentService.getReplies(req.params.commentId!, pagination);
  res.status(200).json({ success: true, data: result });
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  await commentService.deleteComment(req.params.commentId!, req.user!.id);
  res.status(200).json({ success: true, message: 'Comment deleted' });
}

export async function likeComment(req: Request, res: Response): Promise<void> {
  await commentService.likeComment(req.params.commentId!, req.user!.id);
  res.status(200).json({ success: true, message: 'Comment liked' });
}

export async function unlikeComment(req: Request, res: Response): Promise<void> {
  await commentService.unlikeComment(req.params.commentId!, req.user!.id);
  res.status(200).json({ success: true, message: 'Comment unliked' });
}

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function savePost(req: Request, res: Response): Promise<void> {
  await saveService.savePost(req.params.id!, req.user!.id);
  res.status(200).json({ success: true, message: 'Post saved' });
}

export async function unsavePost(req: Request, res: Response): Promise<void> {
  await saveService.unsavePost(req.params.id!, req.user!.id);
  res.status(200).json({ success: true, message: 'Post unsaved' });
}

export async function getSavedPosts(req: Request, res: Response): Promise<void> {
  const pagination = PaginationSchema.parse(req.query);
  const result = await saveService.getSavedPosts(req.user!.id, pagination);
  res.status(200).json({ success: true, data: result });
}

export async function getSaveStatus(req: Request, res: Response): Promise<void> {
  const result = await saveService.getSaveStatus(req.params.id!, req.user!.id);
  res.status(200).json({ success: true, data: result });
}
