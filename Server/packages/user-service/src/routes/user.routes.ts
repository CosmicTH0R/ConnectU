import { Router } from 'express';
import { authMiddleware } from '@instagram/shared';
import { asyncHandler } from '../middleware/async-handler';
import * as userCtrl from '../controllers/user.controller';

const router = Router();

// ─── Authenticated current user ───────────────────────────────────────────────
router.get('/me',          authMiddleware, asyncHandler(userCtrl.getMe));
router.put('/me',          authMiddleware, asyncHandler(userCtrl.updateMe));
router.post('/me/heartbeat', authMiddleware, asyncHandler(userCtrl.heartbeat));

// ─── Search ───────────────────────────────────────────────────────────────────
router.get('/search', asyncHandler(userCtrl.searchUsers));

// ─── Profile lookup ───────────────────────────────────────────────────────────
router.get('/:id',         asyncHandler(userCtrl.getUserById));
router.get('/by/:username', asyncHandler(userCtrl.getUserByUsername));

// ─── Presence ─────────────────────────────────────────────────────────────────
router.get('/:id/presence', asyncHandler(userCtrl.getPresence));

// ─── Follow system ────────────────────────────────────────────────────────────
router.post('/:id/follow',         authMiddleware, asyncHandler(userCtrl.followUser));
router.delete('/:id/follow',       authMiddleware, asyncHandler(userCtrl.unfollowUser));
router.get('/:id/followers',       asyncHandler(userCtrl.getFollowers));
router.get('/:id/following',       asyncHandler(userCtrl.getFollowing));
router.get('/:id/follow-status',   authMiddleware, asyncHandler(userCtrl.getFollowStatus));
router.post('/follow-requests/:followerId/respond', authMiddleware, asyncHandler(userCtrl.respondFollowRequest));

export default router;
