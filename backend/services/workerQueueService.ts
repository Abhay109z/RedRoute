import { BackgroundJob } from '../types.js';

export class WorkerQueueService {
  private jobs: BackgroundJob[] = [];
  private isProcessing: boolean = false;

  constructor() {
    // Background worker loop
    setInterval(() => this.processNextJob(), 1500);
  }

  public enqueue(queue: BackgroundJob['queue'], payload: any): BackgroundJob {
    const job: BackgroundJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      queue,
      payload,
      status: 'queued',
      attempts: 0,
      createdAt: Date.now(),
    };

    this.jobs.push(job);
    if (this.jobs.length > 100) {
      this.jobs.shift();
    }
    return job;
  }

  public getJobs(): BackgroundJob[] {
    return [...this.jobs].reverse();
  }

  public getQueueMetrics(): {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  } {
    return {
      queued: this.jobs.filter((j) => j.status === 'queued').length,
      processing: this.jobs.filter((j) => j.status === 'processing').length,
      completed: this.jobs.filter((j) => j.status === 'completed').length,
      failed: this.jobs.filter((j) => j.status === 'failed').length,
      total: this.jobs.length,
    };
  }

  private processNextJob(): void {
    if (this.isProcessing) return;

    const nextJob = this.jobs.find((j) => j.status === 'queued');
    if (!nextJob) return;

    this.isProcessing = true;
    nextJob.status = 'processing';
    nextJob.attempts++;

    setTimeout(() => {
      nextJob.status = 'completed';
      nextJob.completedAt = Date.now();
      this.isProcessing = false;
    }, 800 + Math.random() * 600);
  }
}

export const workerQueueService = new WorkerQueueService();
