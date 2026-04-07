import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { Redis } from 'ioredis';
import { prisma } from '../db';
import type { RegisterInput, LoginInput } from '../validators/auth.validator';
import type { JwtPayload, AuthTokens } from '@instagram/shared';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN ?? '15m';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── Token helpers ────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

export function signAccessToken(userId: string, username: string): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = { sub: userId, username };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL } as jwt.SignOptions);
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, getRefreshSecret(), {
    expiresIn: REFRESH_TOKEN_TTL,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, getRefreshSecret()) as { sub: string };
}

// ─── Redis key helpers ────────────────────────────────────────────────────────

const refreshKey = (tokenId: string) => `refresh:${tokenId}`;
// ─── Auth service ─────────────────────────────────────────────────────────────

export class AuthService {
  constructor(private readonly redis: Redis) {}

  async register(input: RegisterInput): Promise<{ user: { id: string; username: string; email: string }; tokens: AuthTokens }> {
    // Check existing user
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email.toLowerCase() },
          { username: input.username.toLowerCase() },
        ],
      },
      select: { id: true, email: true, username: true },
    });

    if (existing) {
      if (existing.email === input.email.toLowerCase()) {
        throw Object.assign(new Error('Email already registered'), { status: 409 });
      }
      throw Object.assign(new Error('Username already taken'), { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        username: input.username.toLowerCase(),
        email: input.email.toLowerCase(),
        passwordHash,
        displayName: input.displayName ?? input.username,
      },
      select: { id: true, username: true, email: true },
    });

    const tokens = await this._issueTokens(user.id, user.username);
    return { user, tokens };
  }

  async login(input: LoginInput): Promise<{ user: { id: string; username: string; email: string }; tokens: AuthTokens }> {
    const loginLower = input.login.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: loginLower }, { username: loginLower }],
      },
      select: { id: true, username: true, email: true, passwordHash: true },
    });

    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const tokens = await this._issueTokens(user.id, user.username);
    const { passwordHash: _pw, ...publicUser } = user;
    void _pw; // intentionally unused
    return { user: publicUser, tokens };
  }

  async refresh(token: string): Promise<AuthTokens> {
    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
    }

    // Verify token is stored in Redis (single-use rotation)
    const tokenHash = Buffer.from(token).toString('base64').slice(0, 64);
    const stored = await this.redis.get(refreshKey(tokenHash));
    if (!stored || stored !== payload.sub) {
      throw Object.assign(new Error('Refresh token not recognized'), { status: 401 });
    }

    // Rotate: delete old, issue new
    await this.redis.del(refreshKey(tokenHash));

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, email: true },
    });
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    return this._issueTokens(user.id, user.username);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const tokenHash = Buffer.from(refreshToken).toString('base64').slice(0, 64);
      await this.redis.del(refreshKey(tokenHash));
    } catch {
      // Best-effort; no error if token doesn't exist
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async _issueTokens(userId: string, username: string): Promise<AuthTokens> {
    const accessToken = signAccessToken(userId, username);
    const refreshToken = signRefreshToken(userId);

    // Store refresh token hash → userId for single-use rotation
    const tokenHash = Buffer.from(refreshToken).toString('base64').slice(0, 64);
    await this.redis.set(refreshKey(tokenHash), userId, 'EX', REFRESH_TOKEN_TTL_SECONDS);

    return { accessToken, refreshToken };
  }
}
