import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { FollowService } from '../services/follow.service';
import { PresenceService } from '../services/presence.service';
import { UpdateProfileSchema, PaginationSchema } from '../validators/user.validator';
import { getRedisClient } from '@instagram/shared';

const userService    = new UserService();
const followService  = new FollowService();
const presenceService = new PresenceService(getRedisClient());

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await userService.getById(req.user!.id);
  res.status(200).json({ success: true, data: user });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const user = await userService.updateProfile(req.user!.id, parsed.data);
  res.status(200).json({ success: true, data: user });
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const user = await userService.getById(req.params.id!);
  res.status(200).json({ success: true, data: user });
}

export async function getUserByUsername(req: Request, res: Response): Promise<void> {
  const user = await userService.getByUsername(req.params.username!);
  res.status(200).json({ success: true, data: user });
}

export async function searchUsers(req: Request, res: Response): Promise<void> {
  const q = req.query.q as string;
  if (!q || q.trim().length < 1) {
    res.status(400).json({ success: false, error: 'Query parameter q is required' });
    return;
  }
  const pagination = PaginationSchema.parse(req.query);
  const result = await userService.searchUsers(q.trim(), pagination);
  res.status(200).json({ success: true, data: result });
}

// ─── Follow ───────────────────────────────────────────────────────────────────

export async function followUser(req: Request, res: Response): Promise<void> {
  const result = await followService.follow(req.user!.id, req.params.id!);
  res.status(200).json({ success: true, data: result });
}

export async function unfollowUser(req: Request, res: Response): Promise<void> {
  await followService.unfollow(req.user!.id, req.params.id!);
  res.status(200).json({ success: true, message: 'Unfollowed successfully' });
}

export async function getFollowers(req: Request, res: Response): Promise<void> {
  const pagination = PaginationSchema.parse(req.query);
  const result = await followService.getFollowers(req.params.id!, pagination);
  res.status(200).json({ success: true, data: result });
}

export async function getFollowing(req: Request, res: Response): Promise<void> {
  const pagination = PaginationSchema.parse(req.query);
  const result = await followService.getFollowing(req.params.id!, pagination);
  res.status(200).json({ success: true, data: result });
}

export async function getFollowStatus(req: Request, res: Response): Promise<void> {
  const result = await followService.getFollowStatus(req.user!.id, req.params.id!);
  res.status(200).json({ success: true, data: result });
}

export async function respondFollowRequest(req: Request, res: Response): Promise<void> {
  const { action } = req.body as { action?: string };
  if (action !== 'accept' && action !== 'reject') {
    res.status(400).json({ success: false, error: 'action must be "accept" or "reject"' });
    return;
  }
  await followService.respondToRequest(req.user!.id, req.params.followerId!, action);
  res.status(200).json({ success: true, message: `Follow request ${action}ed` });
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export async function heartbeat(req: Request, res: Response): Promise<void> {
  await presenceService.heartbeat(req.user!.id);
  res.status(200).json({ success: true });
}

export async function getPresence(req: Request, res: Response): Promise<void> {
  const result = await presenceService.getPresence(req.params.id!);
  res.status(200).json({ success: true, data: result });
}
