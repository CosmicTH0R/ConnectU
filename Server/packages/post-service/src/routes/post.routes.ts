import { Router } from 'express';
import { authMiddleware } from '@instagram/shared';
import { asyncHandler } from '../middleware/async-handler';
import * as postCtrl from '../controllers/post.controller';

const router = Router();

// ─── Post CRUD ────────────────────────────────────────────────────────────────
router.post('/',                       authMiddleware, asyncHandler(postCtrl.createPost));
router.get('/',                        asyncHandler(postCtrl.getPostsByHashtag));   // ?hashtag=
router.get('/:id',                     asyncHandler(postCtrl.getPost));
router.patch('/:id',                   authMiddleware, asyncHandler(postCtrl.updatePost));
router.delete('/:id',                  authMiddleware, asyncHandler(postCtrl.deletePost));

// ─── Like ─────────────────────────────────────────────────────────────────────
router.post('/:id/like',               authMiddleware, asyncHandler(postCtrl.likePost));
router.delete('/:id/like',             authMiddleware, asyncHandler(postCtrl.unlikePost));
router.get('/:id/likes',               asyncHandler(postCtrl.getLikes));

// ─── Save ─────────────────────────────────────────────────────────────────────
router.post('/:id/save',               authMiddleware, asyncHandler(postCtrl.savePost));
router.delete('/:id/save',             authMiddleware, asyncHandler(postCtrl.unsavePost));
router.get('/:id/save-status',         authMiddleware, asyncHandler(postCtrl.getSaveStatus));

// ─── Comment ──────────────────────────────────────────────────────────────────
router.post('/:id/comments',           authMiddleware, asyncHandler(postCtrl.addComment));
router.get('/:id/comments',            asyncHandler(postCtrl.getComments));

export default router;
