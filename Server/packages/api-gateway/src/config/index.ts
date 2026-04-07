import { SERVICE_PORTS } from '@instagram/shared';

const internalUrl = (port: number) =>
  `http://${process.env.SERVICE_HOST ?? 'localhost'}:${port}`;

export const config = {
  port: parseInt(process.env.API_GATEWAY_PORT ?? String(SERVICE_PORTS.API_GATEWAY), 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  services: {
    user:           internalUrl(parseInt(process.env.USER_SERVICE_PORT       ?? String(SERVICE_PORTS.USER_SERVICE),           10)),
    post:           internalUrl(parseInt(process.env.POST_SERVICE_PORT       ?? String(SERVICE_PORTS.POST_SERVICE),           10)),
    feed:           internalUrl(parseInt(process.env.FEED_SERVICE_PORT       ?? String(SERVICE_PORTS.FEED_SERVICE),           10)),
    story:          internalUrl(parseInt(process.env.STORY_SERVICE_PORT      ?? String(SERVICE_PORTS.STORY_SERVICE),          10)),
    chat:           internalUrl(parseInt(process.env.CHAT_SERVICE_PORT       ?? String(SERVICE_PORTS.CHAT_SERVICE),           10)),
    notification:   internalUrl(parseInt(process.env.NOTIFICATION_SERVICE_PORT ?? String(SERVICE_PORTS.NOTIFICATION_SERVICE), 10)),
    media:          internalUrl(parseInt(process.env.MEDIA_SERVICE_PORT      ?? String(SERVICE_PORTS.MEDIA_SERVICE),          10)),
    search:         internalUrl(parseInt(process.env.SEARCH_SERVICE_PORT     ?? String(SERVICE_PORTS.SEARCH_SERVICE),         10)),
    recommendation: internalUrl(parseInt(process.env.RECOMMENDATION_SERVICE_PORT ?? String(SERVICE_PORTS.RECOMMENDATION_SERVICE), 10)),
    featureFlag:    internalUrl(parseInt(process.env.FEATURE_FLAG_SERVICE_PORT ?? String(SERVICE_PORTS.FEATURE_FLAG_SERVICE), 10)),
    abTesting:      internalUrl(parseInt(process.env.AB_TESTING_SERVICE_PORT ?? String(SERVICE_PORTS.AB_TESTING_SERVICE),     10)),
  },

  jwtSecret: process.env.JWT_SECRET ?? '',

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').filter(Boolean),

  rateLimit: {
    windowMs: 60_000,           // 1 minute
    defaultMax: 100,            // requests per window per IP
    authMax: 200,               // more for authenticated users
    strictEndpoints: new Map<string, number>([
      ['POST /auth/login',    5],
      ['POST /auth/register', 10],
      ['POST /posts',         30],
    ]),
  },
} as const;
