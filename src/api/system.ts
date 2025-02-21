import { Hono } from 'hono';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../config/database';
import { validateRequest, schemas } from '../middleware/validator';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

// 定义验证数据类型
interface ValidatedData {
  // 自动化规则
  name: string;
  description?: string;
  trigger: {
    type: 'schedule' | 'event';
    condition: string;
  };
  action: {
    type: 'notification' | 'device_control';
    params: Record<string, any>;
  };
  userId: string;
  deviceIds?: string[];
  priority?: 'low' | 'medium' | 'high';
  // 通知
  title?: string;
  message?: string;
  type?: 'info' | 'warning' | 'error';
  recipients?: string[];
  // 系统健康检查
  metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskSpace?: number;
    networkLatency?: number;
  };
}

// 定义环境变量类型
interface Env {
  Variables: {
    validatedData: ValidatedData;
  };
}

const system = new Hono<Env>();

// 创建自动化规则
system.post('/automation', validateRequest(schemas.automationRule), async (c) => {
  const db = await connectToDatabase();
  const data = c.get('validatedData');
  
  const rule = {
    ...data,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const result = await db.collection('automation_rules').insertOne(rule);
  return c.json({
    success: true,
    ruleId: result.insertedId.toString()
  });
});

// 获取用户的自动化规则
system.get('/automation/user/:userId', async (c) => {
  const db = await connectToDatabase();
  const userId = c.req.param('userId');
  
  const rules = await db.collection('automation_rules')
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  
  return c.json(rules.map(rule => ({
    ...rule,
    _id: rule._id.toString()
  })));
});

// 更新自动化规则状态
system.patch('/automation/:ruleId', async (c) => {
  const db = await connectToDatabase();
  const ruleId = c.req.param('ruleId');
  const data = await c.req.json();
  
  const rule = await db.collection('automation_rules').findOne({
    _id: new ObjectId(ruleId)
  });
  
  if (!rule) {
    throw new AppError(404, 'Automation rule not found');
  }
  
  await db.collection('automation_rules').updateOne(
    { _id: new ObjectId(ruleId) },
    {
      $set: {
        status: data.status,
        updatedAt: new Date()
      }
    }
  );
  
  return c.json({ success: true });
});

// 创建通知
system.post('/notification', validateRequest(schemas.notification), async (c) => {
  const db = await connectToDatabase();
  const data = c.get('validatedData');
  
  const notification = {
    ...data,
    status: 'unread',
    createdAt: new Date()
  };
  
  const result = await db.collection('notifications').insertOne(notification);
  return c.json({
    success: true,
    notificationId: result.insertedId.toString()
  });
});

// 获取用户的通知
system.get('/notification/user/:userId', async (c) => {
  const db = await connectToDatabase();
  const userId = c.req.param('userId');
  
  const notifications = await db.collection('notifications')
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  
  return c.json(notifications.map(notification => ({
    ...notification,
    _id: notification._id.toString()
  })));
});

// 标记通知为已读
system.patch('/notification/:notificationId/read', async (c) => {
  const db = await connectToDatabase();
  const notificationId = c.req.param('notificationId');
  
  const notification = await db.collection('notifications').findOne({
    _id: new ObjectId(notificationId)
  });
  
  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }
  
  await db.collection('notifications').updateOne(
    { _id: new ObjectId(notificationId) },
    {
      $set: {
        status: 'read',
        readAt: new Date()
      }
    }
  );
  
  return c.json({ success: true });
});

// 系统状态检查
system.get('/health', async (c) => {
  const db = await connectToDatabase();
  
  try {
    // 检查数据库连接
    await db.command({ ping: 1 });
    
    // 检查各个集合
    const collections = [
      'devices',
      'environment_data',
      'biometric_data',
      'pen_data',
      'study_sessions',
      'tasks',
      'automation_rules',
      'notifications'
    ];
    
    const status = await Promise.all(
      collections.map(async (collection) => {
        const count = await db.collection(collection).countDocuments();
        return { collection, count };
      })
    );
    
    return c.json({
      status: 'healthy',
      database: 'connected',
      collections: status,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    throw new AppError(500, 'System health check failed');
  }
});

export default system;
