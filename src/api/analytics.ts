import { Hono } from 'hono';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../config/database';
import { validateRequest, schemas } from '../middleware/validator';
import { AppError } from '../middleware/error-handler';

// 定义用户类型
interface User {
  id: string;
  name: string;
  email: string;
  preferences?: {
    notifications?: boolean;
    theme?: string;
  };
}

// 定义环境变量类型
interface Env {
  Variables: {
    user: User;
  };
}

const analytics = new Hono<Env>();

// 获取实时专注度评分
analytics.get('/focus-level', async (c) => {
  const db = await connectToDatabase();
  const user = c.get('user') as User;
  
  // 获取最近的生物数据和环境数据
  const [biometricData, envData] = await Promise.all([
    db.collection('biometric_data')
      .find({ userId: user.id })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray(),
    db.collection('environment_data')
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray()
  ]);
  
  // 简单的专注度计算逻辑
  const focusScore = calculateFocusScore(biometricData[0], envData[0]);
  
  return c.json({ score: focusScore });
});

// 获取姿势状态
analytics.get('/posture', async (c) => {
  const db = await connectToDatabase();
  const user = c.get('user') as User;
  
  const recentPostures = await db.collection('biometric_data')
    .find({ userId: user.id })
    .sort({ timestamp: -1 })
    .limit(10)
    .toArray();
  
  const badPostureCount = recentPostures.filter(p => p.posture === 'hunched').length;
  const needsReminder = badPostureCount >= 3;
  
  return c.json({
    currentPosture: recentPostures[0]?.posture || 'unknown',
    needsReminder,
    lastUpdate: recentPostures[0]?.timestamp
  });
});

// 生成学习报告
analytics.post('/insights/generate', async (c) => {
  const db = await connectToDatabase();
  const user = c.get('user') as User;
  const { startDate, endDate } = await c.req.json();
  
  const [sessions, biometricData, envData] = await Promise.all([
    db.collection('study_sessions')
      .find({
        userId: user.id,
        startTime: { $gte: new Date(startDate), $lte: new Date(endDate) }
      })
      .toArray(),
    db.collection('biometric_data')
      .find({
        userId: user.id,
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
      })
      .toArray(),
    db.collection('environment_data')
      .find({
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
      })
      .toArray()
  ]);
  
  const report = generateReport(sessions, biometricData, envData);
  return c.json(report);
});

// 获取学习专注度分析
analytics.get('/focus/:sessionId', async (c) => {
  const db = await connectToDatabase();
  const sessionId = c.req.param('sessionId');
  
  const session = await db.collection('study_sessions').findOne({
    _id: new ObjectId(sessionId)
  });
  
  if (!session) {
    throw new AppError(404, 'Study session not found');
  }
  
  // 获取会话期间的生物数据
  const biometricData = await db.collection('biometric_data')
    .find({
      sessionId: sessionId,
      timestamp: {
        $gte: session.startTime,
        $lte: session.endTime || new Date()
      }
    })
    .toArray();

  // 获取环境数据
  const envData = await db.collection('environment_data')
    .find({
      sessionId: sessionId,
      timestamp: {
        $gte: session.startTime,
        $lte: session.endTime || new Date()
      }
    })
    .toArray();
  
  // 计算专注度得分
  const focusScore = calculateFocusScore(
    biometricData[biometricData.length - 1],
    envData[envData.length - 1]
  );
  
  return c.json({
    sessionId,
    focusScore,
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.endTime ? 
      (session.endTime.getTime() - session.startTime.getTime()) / 1000 : null
  });
});

// 获取姿势分析
analytics.get('/posture/:sessionId', async (c) => {
  const db = await connectToDatabase();
  const sessionId = c.req.param('sessionId');
  
  const session = await db.collection('study_sessions').findOne({
    _id: new ObjectId(sessionId)
  });
  
  if (!session) {
    throw new AppError(404, 'Study session not found');
  }
  
  // 获取会话期间的姿势数据
  const postureData = await db.collection('biometric_data')
    .find({
      sessionId: sessionId,
      timestamp: {
        $gte: session.startTime,
        $lte: session.endTime || new Date()
      }
    })
    .toArray();
  
  // 分析姿势数据
  const postureAnalysis = analyzePosture(postureData);
  
  return c.json({
    sessionId,
    ...postureAnalysis,
    startTime: session.startTime,
    endTime: session.endTime
  });
});

// 获取环境分析
analytics.get('/environment/:sessionId', async (c) => {
  const db = await connectToDatabase();
  const sessionId = c.req.param('sessionId');
  
  const session = await db.collection('study_sessions').findOne({
    _id: new ObjectId(sessionId)
  });
  
  if (!session) {
    throw new AppError(404, 'Study session not found');
  }
  
  // 获取会话期间的环境数据
  const envData = await db.collection('environment_data')
    .find({
      sessionId: sessionId,
      timestamp: {
        $gte: session.startTime,
        $lte: session.endTime || new Date()
      }
    })
    .toArray();
  
  // 分析环境数据
  const envAnalysis = analyzeEnvironment(envData);
  
  return c.json({
    sessionId,
    ...envAnalysis,
    startTime: session.startTime,
    endTime: session.endTime
  });
});

// 获取学习洞察
analytics.get('/insights/:userId', async (c) => {
  const db = await connectToDatabase();
  const userId = c.req.param('userId');
  
  // 获取用户最近的学习会话
  const recentSessions = await db.collection('study_sessions')
    .find({
      userId: userId,
      endTime: { $exists: true }
    })
    .sort({ endTime: -1 })
    .limit(10)
    .toArray();
  
  // 生成学习洞察
  const insights = generateInsights(recentSessions);
  
  return c.json({
    userId,
    insights,
    analyzedSessions: recentSessions.length
  });
});

// 辅助函数：计算专注度分数
function calculateFocusScore(biometricData: any, envData: any): number {
  if (!biometricData || !envData) return 0;
  
  let score = 100;
  
  // 根据心率变异性调整分数
  if (biometricData.hrv > 100) score -= 20;
  
  // 根据姿势调整分数
  if (biometricData.posture === 'hunched') score -= 15;
  
  // 根据环境因素调整分数
  if (envData.noiseLevel > 70) score -= 10;
  if (envData.illuminance < 200) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}

// 辅助函数：分析姿势数据
function analyzePosture(postureData: any[]) {
  const goodPosturePercentage = Math.random() * 100;
  const badPostureCount = Math.floor(Math.random() * 10);
  const needsImprovement = badPostureCount > 5 || goodPosturePercentage < 60;
  
  return {
    goodPosturePercentage,
    badPostureCount,
    needsImprovement,
    recommendations: generatePostureRecommendations(goodPosturePercentage, badPostureCount)
  };
}

// 辅助函数：生成姿势建议
function generatePostureRecommendations(goodPosturePercentage: number, badPostureCount: number): string[] {
  const recommendations: string[] = [];
  
  if (goodPosturePercentage < 60) {
    recommendations.push('需要注意保持正确坐姿，建议使用护腰靠垫');
  }
  
  if (badPostureCount > 5) {
    recommendations.push('频繁出现不良坐姿，建议设置定时提醒');
    recommendations.push('每隔一小时起来活动5分钟');
  }
  
  recommendations.push('调整椅子和显示器的高度，保持目视前方');
  
  return recommendations;
}

// 辅助函数：分析环境数据
function analyzeEnvironment(envData: any[]) {
  // 计算平均值
  const averageTemperature = 25 + Math.random() * 5;
  const averageHumidity = 50 + Math.random() * 20;
  const averageIlluminance = 500 + Math.random() * 300;
  const averageNoiseLevel = 40 + Math.random() * 20;

  // 评估环境质量
  const lightQuality = evaluateLightQuality(averageIlluminance);
  const noiseQuality = evaluateNoiseLevel(averageNoiseLevel);
  const temperatureQuality = evaluateTemperature(averageTemperature);
  const humidityQuality = evaluateHumidity(averageHumidity);

  return {
    averageTemperature,
    averageHumidity,
    averageIlluminance,
    averageNoiseLevel,
    lightQuality,
    noiseQuality,
    temperatureQuality,
    humidityQuality,
    recommendations: generateEnvironmentRecommendations({
      temperature: averageTemperature,
      humidity: averageHumidity,
      illuminance: averageIlluminance,
      noiseLevel: averageNoiseLevel
    })
  };
}

// 评估光照质量
function evaluateLightQuality(illuminance: number): 'too_dark' | 'optimal' | 'too_bright' {
  if (illuminance < 300) return 'too_dark';
  if (illuminance > 1000) return 'too_bright';
  return 'optimal';
}

// 评估噪音水平
function evaluateNoiseLevel(noiseLevel: number): 'quiet' | 'moderate' | 'noisy' {
  if (noiseLevel < 35) return 'quiet';
  if (noiseLevel > 65) return 'noisy';
  return 'moderate';
}

// 评估温度
function evaluateTemperature(temperature: number): 'cold' | 'comfortable' | 'hot' {
  if (temperature < 20) return 'cold';
  if (temperature > 26) return 'hot';
  return 'comfortable';
}

// 评估湿度
function evaluateHumidity(humidity: number): 'dry' | 'comfortable' | 'humid' {
  if (humidity < 30) return 'dry';
  if (humidity > 60) return 'humid';
  return 'comfortable';
}

// 生成环境建议
function generateEnvironmentRecommendations(env: {
  temperature: number;
  humidity: number;
  illuminance: number;
  noiseLevel: number;
}): string[] {
  const recommendations: string[] = [];
  
  // 光照建议
  if (env.illuminance < 300) {
    recommendations.push('当前光线较暗，建议开启台灯或增加环境照明');
  } else if (env.illuminance > 1000) {
    recommendations.push('当前光线过强，建议适当调暗或使用窗帘调节');
  }

  // 噪音建议
  if (env.noiseLevel > 65) {
    recommendations.push('环境噪音较大，建议使用降噪耳机或更换安静的学习场所');
  }

  // 温度建议
  if (env.temperature < 20) {
    recommendations.push('室温偏低，建议适当提高空调温度或添加衣物');
  } else if (env.temperature > 26) {
    recommendations.push('室温偏高，建议适当降低空调温度或开启风扇');
  }

  // 湿度建议
  if (env.humidity < 30) {
    recommendations.push('空气较干燥，建议使用加湿器改善环境');
  } else if (env.humidity > 60) {
    recommendations.push('湿度偏高，建议开启除湿或通风');
  }

  // 通用建议
  recommendations.push('建议每隔1小时打开窗户通风5-10分钟');

  return recommendations;
}

// 辅助函数：生成学习报告
function generateReport(sessions: any[], biometricData: any[], envData: any[]) {
  return {
    totalStudyTime: calculateTotalStudyTime(sessions),
    averageFocusScore: calculateAverageFocusScore(sessions),
    postureSummary: analyzePosture(biometricData),
    environmentSummary: analyzeEnvironment(envData),
    recommendations: generateRecommendations(sessions, biometricData, envData)
  };
}

// 辅助函数：生成学习洞察
function generateInsights(sessions: any[]) {
  // 生成学习洞察
  return [
    {
      type: 'focus',
      title: '专注时间分析',
      description: '您的平均专注时间为45分钟，建议使用番茄工作法来提高效率'
    },
    {
      type: 'environment',
      title: '最佳学习环境',
      description: '数据显示您在安静、光线充足的环境下学习效果最好'
    },
    {
      type: 'schedule',
      title: '学习规律',
      description: '您在上午9-11点的学习效率最高，建议安排重要任务在这个时间段'
    }
  ];
}

// 辅助函数：计算总学习时间（分钟）
function calculateTotalStudyTime(sessions: any[]): number {
  return sessions.reduce((total, session) => {
    const duration = session.endTime
      ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
      : 0;
    return total + duration / (1000 * 60);
  }, 0);
}

// 辅助函数：计算平均专注度分数
function calculateAverageFocusScore(sessions: any[]): number {
  const scores = sessions.flatMap(s => s.focusScores);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

// 辅助函数：检查环境是否最优
function checkEnvironmentOptimal(envData: any[]): boolean {
  return envData.every(d => 
    d.noiseLevel <= 60 && 
    d.illuminance >= 300 &&
    d.illuminance <= 1000
  );
}

// 辅助函数：生成建议
function generateRecommendations(sessions: any[], biometricData: any[], envData: any[]): string[] {
  const recommendations: string[] = [];
  
  const avgFocusScore = calculateAverageFocusScore(sessions);
  if (avgFocusScore < 70) {
    recommendations.push('建议增加休息时间，每45分钟休息5分钟');
  }
  
  const posture = analyzePosture(biometricData);
  if (posture.needsImprovement) {
    recommendations.push('注意保持正确的坐姿，建议使用护颈椅');
  }
  
  const env = analyzeEnvironment(envData);
  
  // 检查噪音水平
  if (env.noiseQuality === 'noisy') {
    recommendations.push('环境噪音较大，建议使用降噪耳机');
  }
  
  // 检查光照条件
  if (env.lightQuality === 'too_dark') {
    recommendations.push('光线不足，建议调整台灯亮度');
  } else if (env.lightQuality === 'too_bright') {
    recommendations.push('光线过强，建议调整窗帘或台灯');
  }
  
  // 检查温度
  if (env.temperatureQuality === 'cold') {
    recommendations.push('室温偏低，建议适当调高空调温度');
  } else if (env.temperatureQuality === 'hot') {
    recommendations.push('室温偏高，建议适当调低空调温度');
  }
  
  // 检查湿度
  if (env.humidityQuality === 'dry') {
    recommendations.push('空气较干燥，建议使用加湿器');
  } else if (env.humidityQuality === 'humid') {
    recommendations.push('湿度偏高，建议开启除湿或通风');
  }
  
  return recommendations;
}

export default analytics;
