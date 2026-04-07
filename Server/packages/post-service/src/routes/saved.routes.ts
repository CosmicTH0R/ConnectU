import { Router } from 'express';
import { authMiddleware } from '@instagram/shared';
import { asyncHandler } from '../middleware/async-handler';
import * as postCtrl from '../controllers/post.controller';

const router = Router();

// ─── Saved posts ────────────────────────────────────────────────
router.get('/me/saved', authMiddleware, asyncHandler(postCtrl.getSavedPosts));

export default router;
