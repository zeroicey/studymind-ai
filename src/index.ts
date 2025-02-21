import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import jwt from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import { cors } from 'hono/cors';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { loggerMiddleware } from './middleware/logger';
import devices from './api/devices';
import sensors from './api/sensors';
import tasks, { registerTaskClient } from './api/tasks';
import analytics from './api/analytics';
import system from './api/system';

// 定义全局环境变量类型
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

const app = new Hono();

// 中间件
app.use('*', cors());
app.use('*', loggerMiddleware);
app.use('*', errorHandler);

// JWT 验证中间件
app.use('/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as User;
    c.set('user', decoded);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// API路由
app.route('/api/devices', devices);
app.route('/api/sensors', sensors);
app.route('/api/tasks', tasks);
app.route('/api/analytics', analytics);
app.route('/api/system', system);

// 基础健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date() });
});

// WebSocket服务器
const wss = new WebSocketServer({ port: Number(process.env.WS_PORT) || 4001 });

wss.on('connection', (ws: WebSocket, req) => {
  logger.info('New WebSocket connection');
  
  // 从URL中获取用户ID
  const userId = new URL(req.url || '', 'ws://localhost').searchParams.get('userId');
  if (userId) {
    registerTaskClient(userId, ws);
    logger.info('Registered WebSocket client', { userId });
  }
  
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      // 处理不同类型的消息
      switch (data.type) {
        case 'device_status':
          handleDeviceStatus(ws, data);
          break;
        case 'sensor_data':
          handleSensorData(ws, data);
          break;
        default:
          logger.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
});

// WebSocket消息处理函数
function handleDeviceStatus(ws: WebSocket, data: any) {
  // 处理设备状态更新
  logger.info('Device status update:', data);
}

function handleSensorData(ws: WebSocket, data: any) {
  // 处理传感器数据
  logger.info('Sensor data received:', data);
}

// 启动HTTP服务器
const port = Number(process.env.PORT) || 4000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port: port
});
