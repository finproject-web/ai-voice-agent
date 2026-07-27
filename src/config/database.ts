import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e: any) => {
    logger.debug('Database query', {
      query: e.query,
      duration: e.duration,
    });
  });
}

prisma.$on('error', (e: any) => {
  logger.error('Database error', { error: e.message });
});

prisma.$on('warn', (e: any) => {
  logger.warn('Database warning', { warning: e.message });
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
