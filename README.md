# StudyMind AI - 智能学习助手系统

## 项目简介

StudyMind AI 是一个智能学习助手系统，它通过实时监控和分析学习行为，为用户提供个性化的学习体验和建议。系统利用多种传感器数据和设备状态，结合机器学习算法，帮助用户保持专注、提高学习效率。

### 主要功能

- 智能学习任务管理
- 实时学习数据分析
- 智能中断和休息提醒
- 学习效率趋势分析
- 自动化学习环境调节
- 环境质量监控
- 多设备协同

## 技术栈

- **后端**: TypeScript, Hono.js
- **数据库**: MongoDB
- **实时通信**: WebSocket
- **身份验证**: JWT
- **监控**: 自定义传感器 API
- **容器化**: Docker

## 数据结构

### 用户 (User)
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  preferences?: {
    notifications?: boolean;
    theme?: string;
  };
}
```

### 学习任务 (Task)
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  userId: string;
  subject?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Date;
  tags?: string[];
  status: 'pending' | 'in_progress' | 'completed';
  currentSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 学习会话 (StudySession)
```typescript
interface StudySession {
  id: string;
  taskId: string;
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
  status: 'active' | 'paused' | 'completed';
  metrics: {
    keystrokes?: number;
    mouseMovements?: number;
    screenTime?: number;
    idleTime?: number;
  };
}
```

### 环境数据 (EnvironmentData)
```typescript
interface EnvironmentData {
  deviceId: string;
  timestamp: Date;
  temperature?: number;
  humidity?: number;
  noise?: number;
  light?: number;
  airQuality?: number;
}
```

## API 文档

### 认证

所有API请求需要在header中包含JWT token：
```
Authorization: Bearer <token>
```

### 任务管理 API

#### 创建任务
- **POST** `/api/tasks`
```typescript
// Request
{
  "title": string,
  "description": string?,
  "subject": string?,
  "priority": "low" | "medium" | "high",
  "dueDate": Date?,
  "tags": string[]?
}

// Response
{
  "success": true,
  "taskId": string
}
```

#### 获取任务列表
- **GET** `/api/tasks/user/:userId`
```typescript
// Response
{
  "tasks": [Task]
}
```

#### 开始学习会话
- **POST** `/api/tasks/:taskId/start`
```typescript
// Response
{
  "success": true,
  "sessionId": string
}
```

#### 记录中断
- **POST** `/api/tasks/:taskId/interrupt`
```typescript
// Request
{
  "reason": string?,
  "type": "manual_pause" | "auto_pause"
}

// Response
{
  "success": true
}
```

### 分析 API

#### 获取专注度分析
- **GET** `/api/analytics/focus/:sessionId`
```typescript
// Response
{
  "focusScore": number,
  "factors": {
    "interruptions": number,
    "environmentQuality": number,
    "timeOnTask": number
  }
}
```

#### 获取环境质量评估
- **GET** `/api/analytics/environment/:deviceId`
```typescript
// Response
{
  "quality": "good" | "fair" | "poor",
  "recommendations": string[],
  "metrics": {
    "temperature": number,
    "humidity": number,
    "noise": number,
    "light": number,
    "airQuality": number
  }
}
```

### WebSocket API

#### 任务状态更新
```typescript
// 连接
ws://server/ws/tasks/:taskId

// 消息格式
{
  "type": "status_update" | "focus_alert" | "environment_alert",
  "data": {
    // 根据type不同而变化
  }
}
```

## 项目运行

### 环境要求

- Node.js >= 18
- MongoDB >= 5.0
- Docker (可选)

### 本地开发

1. 克隆项目
```bash
git clone https://github.com/zeroicey/studymind-ai.git
cd studymind-ai
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件设置必要的环境变量
```

4. 启动开发服务器
```bash
npm run dev
```

### Docker 部署

1. 构建镜像
```bash
docker build -t studymind-ai .
```

2. 运行容器
```bash
docker run -d \
  -p 4000:4000 \
  -e MONGODB_URI=your_mongodb_uri \
  -e JWT_SECRET=your_jwt_secret \
  studymind-ai
```

To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000
