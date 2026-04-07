import { Router } from 'express';
import { authMiddleware } from '@instagram/shared';
import { asyncHandler } from '../middleware/async-handler';
import * as postCtrl from '../controllers/post.controller';

const router = Router();

// ─── Comment routes (nested under /comments) ──────────────────────────────────
router.get('/:commentId/replies',      asyncHandler(postCtrl.getCommentReplies));
router.delete('/:commentId',           authMiddleware, asyncHandler(postCtrl.deleteComment));
router.post('/:commentId/like',        authMiddleware, asyncHandler(postCtrl.likeComment));
router.delete('/:commentId/like',      authMiddleware, asyncHandler(postCtrl.unlikeComment));

export default router;
