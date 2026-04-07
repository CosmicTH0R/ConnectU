import { Router, Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import { config } from '../config';
import { authMiddleware } from '@instagram/shared';

const router = Router();

// ─── Proxy option factory ─────────────────────────────────────────────────────

function makeProxy(targetBase: string) {
  return proxy(targetBase, {
    proxyReqPathResolver: (req: Request) => req.originalUrl,
    proxyErrorHandler: (err: Error, res: Response, next: NextFunction) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
        return;
      }
      next(err);
    },
    // Forward the request-id and user info as headers to downstream services
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers = proxyReqOpts.headers ?? {};
      if (srcReq.requestId) {
        proxyReqOpts.headers['x-request-id'] = srcReq.requestId;
      }
      if (srcReq.user) {
        proxyReqOpts.headers['x-user-id'] = srcReq.user.id;
        proxyReqOpts.headers['x-username'] = srcReq.user.username;
      }
      return proxyReqOpts;
    },
  });
}

// ─── Public routes (no auth required) ────────────────────────────────────────

// Auth (register / login / refresh)
router.use('/auth', makeProxy(config.services.user));

// Public media delivery
router.get('/media/:id', makeProxy(config.services.media));

// ─── Protected routes (auth required) ────────────────────────────────────────

// Post-service routes mounted under /users (must come before /users proxy to user-service)
router.use('/users/me/saved',  authMiddleware, makeProxy(config.services.post));
router.get('/users/:id/posts', authMiddleware, makeProxy(config.services.post));

router.use('/users',           authMiddleware, makeProxy(config.services.user));
router.use('/posts',           authMiddleware, makeProxy(config.services.post));
router.use('/comments',        authMiddleware, makeProxy(config.services.post));
router.use('/feed',            authMiddleware, makeProxy(config.services.feed));
router.use('/stories',         authMiddleware, makeProxy(config.services.story));
router.use('/highlights',      authMiddleware, makeProxy(config.services.story));
router.use('/conversations',   authMiddleware, makeProxy(config.services.chat));
router.use('/messages',        authMiddleware, makeProxy(config.services.chat));
router.use('/notifications',   authMiddleware, makeProxy(config.services.notification));
router.use('/media',           authMiddleware, makeProxy(config.services.media));
router.use('/search',          authMiddleware, makeProxy(config.services.search));
router.use('/recommendations', authMiddleware, makeProxy(config.services.recommendation));
router.use('/reels',           authMiddleware, makeProxy(config.services.post));
router.use('/analytics',       authMiddleware, makeProxy(config.services.post));

// ─── Admin routes ─────────────────────────────────────────────────────────────

router.use('/flags',       authMiddleware, makeProxy(config.services.featureFlag));
router.use('/experiments', authMiddleware, makeProxy(config.services.abTesting));

export { router as proxyRoutes };
