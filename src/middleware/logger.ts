import { Context, Next } from 'hono';
import { logger } from '../utils/logger';

export const loggerMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  const { method, url } = c.req;
  
  // 记录请求开始
  logger.info(`--> ${method} ${url}`);
  
  try {
    await next();
  } catch (error) {
    // 记录错误
    logger.error(`Error processing ${method} ${url}:`, error);
    throw error;
  }
  
  // 记录请求完成
  const duration = Date.now() - start;
  logger.info(`<-- ${method} ${url} (${duration}ms)`);
};
