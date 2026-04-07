import Redis from 'ioredis';

export interface MediaJob {
  jobId: string;
  userId: string;
  key: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export class JobService {
  constructor(private redis: Redis) {}

  async createJob(job: MediaJob) {
    await this.redis.set(`media:job:${job.jobId}`,
      JSON.stringify(job), 'EX', 24 * 60 * 60);
  }

  async completeJob(jobId: string, result: any) {
    const job = await this.getJob(jobId);
    if (!job) return;
    job.status = 'done';
    job.result = result;
    job.updatedAt = Date.now();
    await this.createJob(job);
  }

  async failJob(jobId: string, error: string) {
    const job = await this.getJob(jobId);
    if (!job) return;
    job.status = 'error';
    job.error = error;
    job.updatedAt = Date.now();
    await this.createJob(job);
  }

  async getJob(jobId: string): Promise<MediaJob | null> {
    const data = await this.redis.get(`media:job:${jobId}`);
    return data ? JSON.parse(data) : null;
  }
}
