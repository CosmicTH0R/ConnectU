import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import * as postCtrl from '../controllers/post.controller';

const router = Router();

// ─── User-specific post routes ────────────────────────────────────────────────
router.get('/:userId/posts', asyncHandler(postCtrl.getUserPosts));

export default router;
