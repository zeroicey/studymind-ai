import { Hono } from 'hono';
import { ObjectId } from 'mongodb';
import { WebSocket } from 'ws';
import { connectToDatabase } from '../config/database';
import { validateRequest, schemas } from '../middleware/validator';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

// 定义验证数据类型
interface ValidatedData {
  // 任务基本信息
  title: string;
  description?: string;
  userId: string;
  subject?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Date;
  tags?: string[];
  
  // 学习会话相关
  sessionId?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  breakInterval?: number;
  
  // 目标和进度
  goals?: {
    type: 'time' | 'pages' | 'exercises';
    target: number;
    current?: number;
  }[];
  
  // 中断和恢复
  interruptReason?: string;
  resumeNote?: string;
}

// 定义环境变量类型
interface Env {
  Variables: {
    validatedData: ValidatedData;
  };
}

// MongoDB 文档类型定义
interface StudySession {
  _id: ObjectId;
  taskId: ObjectId;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  interruptions: Array<{
    time: Date;
    type: string;
    reason?: string;
  }>;
  focusScore?: number;
  status?: 'active' | 'paused' | 'completed';
  metrics?: {
    keystrokes?: number;
    mouseMovements?: number;
    screenTime?: number;
    idleTime?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const tasks = new Hono<Env>();

// WebSocket客户端管理
const taskClients = new Map<string, WebSocket>();

export function registerTaskClient(taskId: string, ws: WebSocket) {
  taskClients.set(taskId, ws);
  
  ws.on('close', () => {
    taskClients.delete(taskId);
    logger.info(`Task client disconnected: ${taskId}`);
  });
  
  logger.info(`New task client registered: ${taskId}`);
}

export function notifyTaskUpdate(taskId: string, data: any) {
  const client = taskClients.get(taskId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
}

// 创建学习任务
tasks.post('/', validateRequest(schemas.createTask), async (c) => {
  const db = await connectToDatabase();
  const data = c.get('validatedData');
  
  const task = {
    ...data,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const result = await db.collection('tasks').insertOne(task);
  return c.json({
    success: true,
    taskId: result.insertedId.toString()
  });
});

// 获取任务列表
tasks.get('/user/:userId', async (c) => {
  const db = await connectToDatabase();
  const userId = c.req.param('userId');
  
  const tasks = await db.collection('tasks')
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  
  return c.json(tasks.map(task => ({
    ...task,
    _id: task._id.toString()
  })));
});

// 开始学习会话
tasks.post('/:taskId/start', async (c) => {
  const db = await connectToDatabase();
  const taskId = c.req.param('taskId');
  
  const task = await db.collection('tasks').findOne({
    _id: new ObjectId(taskId)
  });
  
  if (!task) {
    throw new AppError(404, 'Task not found');
  }
  
  if (task.status === 'in_progress') {
    throw new AppError(400, 'Task is already in progress');
  }
  
  // 创建新的学习会话
  const session = {
    taskId: taskId,
    userId: task.userId,
    startTime: new Date(),
    status: 'active',
    focusScore: 0,
    interruptions: []
  };
  
  const result = await db.collection('study_sessions').insertOne(session);
  
  // 更新任务状态
  await db.collection('tasks').updateOne(
    { _id: new ObjectId(taskId) },
    {
      $set: {
        status: 'in_progress',
        currentSessionId: result.insertedId.toString(),
        updatedAt: new Date()
      }
    }
  );
  
  return c.json({
    success: true,
    sessionId: result.insertedId.toString()
  });
});

// 暂停学习会话
tasks.post('/:taskId/pause', async (c) => {
  const db = await connectToDatabase();
  const taskId = c.req.param('taskId');
  
  const task = await db.collection('tasks').findOne({
    _id: new ObjectId(taskId)
  });
  
  if (!task) {
    throw new AppError(404, 'Task not found');
  }
  
  if (!task.currentSessionId) {
    throw new AppError(400, 'No active session found');
  }
  
  // 记录中断
  await db.collection<StudySession>('study_sessions').updateOne(
    { _id: new ObjectId(task.currentSessionId) },
    {
      $set: {
        updatedAt: new Date()
      },
      $push: {
        interruptions: {
          time: new Date(),
          type: 'manual_pause'
        }
      }
    }
  );
  
  return c.json({ success: true });
});

// 完成学习会话
tasks.post('/:taskId/complete', async (c) => {
  const db = await connectToDatabase();
  const taskId = c.req.param('taskId');
  
  const task = await db.collection('tasks').findOne({
    _id: new ObjectId(taskId)
  });
  
  if (!task) {
    throw new AppError(404, 'Task not found');
  }
  
  if (!task.currentSessionId) {
    throw new AppError(400, 'No active session found');
  }
  
  // 结束学习会话
  await db.collection<StudySession>('study_sessions').updateOne(
    { _id: new ObjectId(task.currentSessionId) },
    {
      $set: {
        endTime: new Date(),
        status: 'completed'
      }
    }
  );
  
  // 更新任务状态
  await db.collection('tasks').updateOne(
    { _id: new ObjectId(taskId) },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      },
      $unset: {
        currentSessionId: ""
      }
    }
  );
  
  return c.json({ success: true });
});

// 获取会话统计
tasks.get('/session/:sessionId/stats', async (c) => {
  const db = await connectToDatabase();
  const sessionId = c.req.param('sessionId');
  
  const session = await db.collection<StudySession>('study_sessions').findOne({
    _id: new ObjectId(sessionId)
  });
  
  if (!session) {
    throw new AppError(404, 'Session not found');
  }
  
  // 计算会话统计数据
  const stats = {
    duration: session.endTime ? 
      (session.endTime.getTime() - session.startTime.getTime()) / 1000 : null,
    interruptions: session.interruptions.length,
    focusScore: session.focusScore,
    status: session.status
  };
  
  return c.json(stats);
});

export default tasks;
