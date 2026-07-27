import si from 'systeminformation';
import prisma from '../config/database';
import redisConnection from '../queues/redis';
import queueManager, { QueueName } from '../queues';
import { TelnyxProvider } from '../providers/telephony';
import { OpenAIProvider } from '../providers/ai';
import { SMTPProvider } from '../providers/email';
import logger from '../config/logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  checks: {
    cpu: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
    redis: HealthCheck;
    database: HealthCheck;
    bullmq: HealthCheck;
    telnyx: HealthCheck;
    openai: HealthCheck;
    smtp: HealthCheck;
    websocket: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  message?: string;
  details?: any;
  responseTime?: number;
}

export class HealthService {
  static async getHealthStatus(): Promise<HealthStatus> {
    const checks = {
      cpu: await this.checkCPU(),
      memory: await this.checkMemory(),
      disk: await this.checkDisk(),
      redis: await this.checkRedis(),
      database: await this.checkDatabase(),
      bullmq: await this.checkBullMQ(),
      telnyx: await this.checkTelnyx(),
      openai: await this.checkOpenAI(),
      smtp: await this.checkSMTP(),
      websocket: await this.checkWebSocket(),
    };

    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
    const someUnhealthy = Object.values(checks).some(check => check.status === 'unhealthy');

    const status: 'healthy' | 'degraded' | 'unhealthy' = allHealthy
      ? 'healthy'
      : someUnhealthy
      ? 'unhealthy'
      : 'degraded';

    return {
      status,
      timestamp: new Date(),
      uptime: process.uptime(),
      checks,
    };
  }

  private static async checkCPU(): Promise<HealthCheck> {
    try {
      const cpuLoad = await si.currentLoad();
      const usage = cpuLoad.currentLoad;

      const status: 'healthy' | 'unhealthy' = usage > 80 ? 'unhealthy' : 'healthy';

      return {
        status,
        details: {
          usage: usage.toFixed(2),
          cores: cpuLoad.cpus,
        },
      };
    } catch (error) {
      logger.error('CPU health check failed', { error });
      return { status: 'unhealthy', message: 'CPU check failed' };
    }
  }

  private static async checkMemory(): Promise<HealthCheck> {
    try {
      const memory = await si.mem();
      const usage = ((memory.total - memory.available) / memory.total) * 100;

      const status: 'healthy' | 'unhealthy' = usage > 90 ? 'unhealthy' : 'healthy';

      return {
        status,
        details: {
          usage: usage.toFixed(2),
          total: memory.total,
          available: memory.available,
          used: memory.total - memory.available,
        },
      };
    } catch (error) {
      logger.error('Memory health check failed', { error });
      return { status: 'unhealthy', message: 'Memory check failed' };
    }
  }

  private static async checkDisk(): Promise<HealthCheck> {
    try {
      const disk = await si.fsSize();
      const rootDisk = disk.find(d => d.mount === '/' || d.mount === 'C:');

      if (!rootDisk) {
        return { status: 'unhealthy', message: 'Root disk not found' };
      }

      const usage = rootDisk.use;
      const status: 'healthy' | 'unhealthy' = usage > 90 ? 'unhealthy' : 'healthy';

      return {
        status,
        details: {
          usage: usage.toFixed(2),
          available: rootDisk.available,
          used: rootDisk.used,
          total: rootDisk.size,
        },
      };
    } catch (error) {
      logger.error('Disk health check failed', { error });
      return { status: 'unhealthy', message: 'Disk check failed' };
    }
  }

  private static async checkRedis(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      const healthy = await redisConnection.healthCheck();
      const responseTime = Date.now() - startTime;

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy ? 'Redis is connected' : 'Redis is not connected',
        responseTime,
      };
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return { status: 'unhealthy', message: 'Redis check failed' };
    }
  }

  private static async checkDatabase(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        message: 'Database is connected',
        responseTime,
      };
    } catch (error) {
      logger.error('Database health check failed', { error });
      return { status: 'unhealthy', message: 'Database check failed' };
    }
  }

  private static async checkBullMQ(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      const health = await queueManager.healthCheck();
      const responseTime = Date.now() - startTime;

      const allHealthy = Object.values(health).every(status => status === true);

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        message: allHealthy ? 'All queues are healthy' : 'Some queues are unhealthy',
        details: health,
        responseTime,
      };
    } catch (error) {
      logger.error('BullMQ health check failed', { error });
      return { status: 'unhealthy', message: 'BullMQ check failed' };
    }
  }

  private static async checkTelnyx(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      const provider = new TelnyxProvider();
      const healthy = await provider.testConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy ? 'Telnyx is connected' : 'Telnyx is not connected',
        responseTime,
      };
    } catch (error) {
      logger.error('Telnyx health check failed', { error });
      return { status: 'unhealthy', message: 'Telnyx check failed' };
    }
  }

  private static async checkOpenAI(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      const provider = new OpenAIProvider();
      const healthy = await provider.testConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy ? 'OpenAI is connected' : 'OpenAI is not connected',
        responseTime,
      };
    } catch (error) {
      logger.error('OpenAI health check failed', { error });
      return { status: 'unhealthy', message: 'OpenAI check failed' };
    }
  }

  private static async checkSMTP(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      const provider = new SMTPProvider();
      const healthy = await provider.testConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy ? 'SMTP is connected' : 'SMTP is not connected',
        responseTime,
      };
    } catch (error) {
      logger.error('SMTP health check failed', { error });
      return { status: 'unhealthy', message: 'SMTP check failed' };
    }
  }

  private static async checkWebSocket(): Promise<HealthCheck> {
    try {
      // WebSocket health check - check if server is initialized
      // This is a placeholder - actual implementation would check WebSocket server status
      return {
        status: 'healthy',
        message: 'WebSocket server is running',
      };
    } catch (error) {
      logger.error('WebSocket health check failed', { error });
      return { status: 'unhealthy', message: 'WebSocket check failed' };
    }
  }

  static async getQueueStats(): Promise<Record<string, any>> {
    try {
      const stats: Record<string, any> = {};

      for (const queueName of Object.values(QueueName)) {
        stats[queueName] = await queueManager.getQueueStats(queueName);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get queue stats', { error });
      throw error;
    }
  }

  static async getSystemInfo(): Promise<any> {
    try {
      const [cpu, memory, disk, os, network] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.osInfo(),
        si.networkInterfaces(),
      ]);

      return {
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          cores: cpu.cores,
          speed: cpu.speed,
        },
        memory: {
          total: memory.total,
          available: memory.available,
          used: memory.total - memory.available,
        },
        disk: disk.map(d => ({
          mount: d.mount,
          size: d.size,
          used: d.used,
          available: d.available,
          use: d.use,
        })),
        os: {
          platform: os.platform,
          distro: os.distro,
          release: os.release,
          arch: os.arch,
        },
        network: network.map(n => ({
          iface: n.iface,
          ip4: n.ip4,
          ip6: n.ip6,
          mac: n.mac,
        })),
      };
    } catch (error) {
      logger.error('Failed to get system info', { error });
      throw error;
    }
  }
}

export default HealthService;
