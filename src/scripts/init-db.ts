import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'harmony_aaa';

async function createIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    logger.info('Connected to MongoDB');
    
    // 设备集合索引
    await db.collection('devices').createIndexes([
      { key: { userId: 1 } },
      { key: { type: 1 } },
      { key: { status: 1 } }
    ]);
    
    // 环境数据集合索引
    await db.collection('environment_data').createIndexes([
      { key: { deviceId: 1 } },
      { key: { timestamp: -1 } }
    ]);
    
    // 生物数据集合索引
    await db.collection('biometric_data').createIndexes([
      { key: { deviceId: 1 } },
      { key: { timestamp: -1 } }
    ]);
    
    // 笔记数据集合索引
    await db.collection('pen_data').createIndexes([
      { key: { sessionId: 1 } },
      { key: { timestamp: -1 } }
    ]);
    
    // 学习会话集合索引
    await db.collection('study_sessions').createIndexes([
      { key: { userId: 1 } },
      { key: { startTime: -1 } },
      { key: { status: 1 } }
    ]);
    
    // 分析报告集合索引
    await db.collection('analytics').createIndexes([
      { key: { userId: 1 } },
      { key: { sessionId: 1 } },
      { key: { type: 1 } },
      { key: { timestamp: -1 } }
    ]);
    
    // 自动化规则集合索引
    await db.collection('automation_rules').createIndexes([
      { key: { userId: 1 } },
      { key: { type: 1 } },
      { key: { status: 1 } }
    ]);
    
    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.error('Error creating database indexes:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// 运行初始化
createIndexes().catch(console.error);
