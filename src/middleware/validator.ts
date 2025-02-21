import { Context, Next } from 'hono';
import { z } from 'zod';
import { AppError } from './error-handler';

// 验证模式定义
export const schemas = {
  // 设备相关
  deviceBind: z.object({
    type: z.enum(['desk_lamp', 'smartwatch', 'stylus']),
    name: z.string().min(1),
    userId: z.string()
  }),
  
  // 传感器数据相关
  environmentData: z.object({
    deviceId: z.string(),
    temperature: z.number(),
    humidity: z.number(),
    light: z.number(),
    noise: z.number()
  }),
  
  biometricData: z.object({
    deviceId: z.string(),
    heartRate: z.number(),
    posture: z.string(),
    movement: z.number()
  }),
  
  penData: z.object({
    sessionId: z.string(),
    deviceId: z.string(),
    coordinates: z.array(
      z.object({
        x: z.number(),
        y: z.number(),
        pressure: z.number(),
        timestamp: z.number()
      })
    )
  }),
  
  // 任务相关
  createTask: z.object({
    userId: z.string(),
    title: z.string().min(1),
    description: z.string().optional(),
    duration: z.number().min(0),
    type: z.enum(['study', 'review', 'practice']),
    priority: z.enum(['low', 'medium', 'high']).optional()
  }),
  
  // 自动化规则相关
  automationRule: z.object({
    userId: z.string(),
    name: z.string().min(1),
    type: z.enum(['light', 'notification', 'focus']),
    trigger: z.object({
      condition: z.string(),
      value: z.any()
    }),
    action: z.object({
      type: z.string(),
      params: z.record(z.any())
    }),
    schedule: z.object({
      active: z.boolean(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      days: z.array(z.number()).optional()
    }).optional()
  }),
  
  // 通知相关
  notification: z.object({
    userId: z.string(),
    type: z.enum(['alert', 'reminder', 'suggestion']),
    title: z.string().min(1),
    message: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    data: z.record(z.any()).optional()
  })
};

// 验证中间件
export const validateRequest = (schema: z.ZodSchema) => {
  return async (c: Context, next: Next) => {
    try {
      const data = await c.req.json();
      const validatedData = schema.parse(data);
      c.set('validatedData', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Validation failed', error.errors);
      }
      throw error;
    }
  };
};
