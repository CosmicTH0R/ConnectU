import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '../validators/auth.validator';
import { getRedisClient } from '@instagram/shared';

const authService = new AuthService(getRedisClient());

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const result = await authService.register(parsed.data);
  res.status(201).json({ success: true, data: result });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const result = await authService.login(parsed.data);
  res.status(200).json({ success: true, data: result });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const parsed = RefreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'refreshToken is required' });
    return;
  }

  const tokens = await authService.refresh(parsed.data.refreshToken);
  res.status(200).json({ success: true, data: tokens });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const parsed = RefreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'refreshToken is required' });
    return;
  }

  await authService.logout(parsed.data.refreshToken);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
}
