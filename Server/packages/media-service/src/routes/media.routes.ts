import { Router } from 'express';
import multer from 'multer';
import Redis from 'ioredis';
import { getStorageProvider } from '../providers';
import { MediaService } from '../services/media.service';
import { JobService } from '../services/job.service';
import { MediaController } from '../controllers/media.controller';
import { asyncHandler } from '../middleware/async-handler';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB hard cap (media.service enforces per-type)
});

function buildRouter(redis: Redis): Router {
  const provider   = getStorageProvider();
  const jobService = new JobService(redis);
  const service    = new MediaService(redis, provider, jobService);
  const ctrl       = new MediaController(service, jobService);

  const router = Router();

  router.post('/upload',     upload.single('file'), asyncHandler(ctrl.upload.bind(ctrl)));
  router.post('/upload-url',                        asyncHandler(ctrl.getUploadUrl.bind(ctrl)));
  router.get( '/jobs/:jobId',                       asyncHandler(ctrl.getJobStatus.bind(ctrl)));
  router.delete('/*',                               asyncHandler(ctrl.deleteMedia.bind(ctrl)));

  return router;
}

export default buildRouter;
