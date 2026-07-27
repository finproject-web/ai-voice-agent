import { Queue, Worker, QueueOptions, Job } from 'bullmq';
import redisConnection from './redis';
import logger from '../config/logger';

export enum QueueName {
  OUTBOUND_CALL = 'outbound-call',
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  ANALYTICS = 'analytics',
  AI_PROCESSING = 'ai-processing',
  RETRY = 'retry',
}

export class QueueManager {
  private queues: Map<QueueName, Queue> = new Map();
  private workers: Map<QueueName, Worker> = new Map();

  private getQueueOptions(): QueueOptions {
    return {
      connection: redisConnection.getClient(),
      defaultJobOptions: {
        removeOnComplete: {
          count: 1000,
          age: 24 * 3600, // 24 hours
        },
        removeOnFail: {
          count: 5000,
          age: 7 * 24 * 3600, // 7 days
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    };
  }

  getQueue(name: QueueName): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, this.getQueueOptions());
      this.queues.set(name, queue);
      logger.info(`Queue created: ${name}`);
    }
    return this.queues.get(name)!;
  }

  async addJob<T>(queueName: QueueName, jobName: string, data: T, options?: any): Promise<Job> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, options);
    logger.info(`Job added to queue: ${queueName}.${jobName}`, { jobId: job.id });
    return job;
  }

  async processQueue(
    queueName: QueueName,
    processor: (job: Job) => Promise<void>,
    concurrency: number = 5
  ): Promise<void> {
    if (this.workers.has(queueName)) {
      logger.warn(`Worker already exists for queue: ${queueName}`);
      return;
    }

    const worker = new Worker(
      queueName,
      processor,
      {
        connection: redisConnection.getClient(),
        concurrency,
      }
    );

    worker.on('completed', (job) => {
      logger.info(`Job completed: ${queueName}.${job.name}`, { jobId: job.id });
    });

    worker.on('failed', (job, error) => {
      logger.error(`Job failed: ${queueName}.${job?.name}`, { jobId: job?.id, error });
    });

    worker.on('error', (error) => {
      logger.error(`Worker error: ${queueName}`, { error });
    });

    this.workers.set(queueName, worker);
    logger.info(`Worker started for queue: ${queueName}`);
  }

  async getQueueStats(queueName: QueueName): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    logger.info(`Queue paused: ${queueName}`);
  }

  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    logger.info(`Queue resumed: ${queueName}`);
  }

  async closeAll(): Promise<void> {
    for (const [name, worker] of this.workers) {
      await worker.close();
      logger.info(`Worker closed: ${name}`);
    }

    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info(`Queue closed: ${name}`);
    }

    this.workers.clear();
    this.queues.clear();
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, queue] of this.queues) {
      try {
        await queue.getJobCounts();
        health[name] = true;
      } catch (error) {
        health[name] = false;
      }
    }

    return health;
  }
}

export default new QueueManager();
