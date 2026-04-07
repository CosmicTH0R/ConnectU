import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import * as auth from '../controllers/auth.controller';

const router = Router();

// POST /auth/register
router.post('/register', asyncHandler(auth.register));

// POST /auth/login
router.post('/login', asyncHandler(auth.login));

// POST /auth/refresh
router.post('/refresh', asyncHandler(auth.refresh));

// POST /auth/logout
router.post('/logout', asyncHandler(auth.logout));

export default router;
