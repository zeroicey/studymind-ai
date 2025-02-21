import { Hono } from 'hono';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../config/database';
import { EnvironmentData, BiometricData, PenData } from '../models/types';
import { validateRequest, schemas } from '../middleware/validator';
import { AppError } from '../middleware/error-handler';

// 定义验证数据类型
interface ValidatedData {
  deviceId: string;
  sessionId?: string;
  // 环境数据
  temperature?: number;
  humidity?: number;
  illuminance?: number;
  noiseLevel?: number;
  // 生物数据
  heartRate?: number;
  hrv?: number;
  posture?: 'good' | 'hunched';
  // 手写笔数据
  pressure?: number;
  angle?: number;
  coordinates?: { x: number; y: number; }[];
}

// 定义环境变量类型
interface Env {
  Variables: {
    validatedData: ValidatedData;
  };
}

const sensors = new Hono<Env>();

// 环境数据上报
sensors.post('/env', validateRequest(schemas.environmentData), async (c) => {
  const db = await connectToDatabase();
  const data = c.get('validatedData');
  
  // 验证设备存在
  const device = await db.collection('devices').findOne({
    _id: new ObjectId(data.deviceId)
  });
  
  if (!device) {
    throw new AppError(404, 'Device not found');
  }
  
  const envData: Partial<EnvironmentData> = {
    ...data,
    timestamp: new Date()
  };
  
  await db.collection('environment_data').insertOne(envData);
  return c.json({ success: true });
});

// 生物数据上报
sensors.post('/biometric', validateRequest(schemas.biometricData), async (c) => {
  const db = await connectToDatabase();
  const data = c.get('validatedData');
  
  const biometricData: Partial<BiometricData> = {
    ...data,
    timestamp: new Date()
  };
  
  await db.collection('biometric_data').insertOne(biometricData);
  return c.json({ success: true });
});

// 手写笔数据上报
sensors.post('/pen', validateRequest(schemas.penData), async (c) => {
  const db = await connectToDatabase();
  const data = c.get('validatedData');
  
  // 验证会话存在
  const session = await db.collection('study_sessions').findOne({
    _id: new ObjectId(data.sessionId)
  });
  
  if (!session) {
    throw new AppError(404, 'Study session not found');
  }
  
  const penData: Partial<PenData> = {
    ...data,
    timestamp: new Date()
  };
  
  await db.collection('pen_data').insertOne(penData);
  return c.json({ success: true });
});

export default sensors;
