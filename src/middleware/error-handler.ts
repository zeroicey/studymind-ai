import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

// 定义可用的错误状态码
type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;

export class AppError extends Error {
  constructor(
    public status: ErrorStatusCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    
    if (error instanceof AppError) {
      return c.json({
        error: error.message,
        details: error.details
      }, error.status);
    }
    
    if (error instanceof HTTPException) {
      return c.json({
        error: error.message,
        details: error.getResponse()
      }, error.status as ErrorStatusCode);
    }
    
    // 处理其他未知错误
    return c.json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
};
