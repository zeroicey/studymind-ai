import { ObjectId } from 'mongodb';

export type User = {
  _id: ObjectId;
  username: string;
  role: 'student' | 'parent' | 'teacher';
  learningGoals: string[];
  deviceBindings: string[];
  points: number;
};

export type Device = {
  _id: ObjectId;
  type: 'desk_lamp' | 'smartwatch' | 'stylus';
  vendor: 'xiaomi' | 'huawei' | 'wacom';
  status: 'online' | 'offline' | 'error';
  lastHeartbeat: Date;
  capabilities: {
    envSensing?: boolean;
    pressureDetection?: boolean;
    healthMonitoring?: boolean;
  };
};

export type EnvironmentData = {
  _id: ObjectId;
  deviceId: string;
  timestamp: Date;
  illuminance: number;
  temperature: number;
  humidity: number;
  noiseLevel: number;
};

export type BiometricData = {
  _id: ObjectId;
  userId: string;
  timestamp: Date;
  heartRate: number;
  hrv: number;
  posture: 'good' | 'hunched';
  movementFrequency: number;
};

export type PenData = {
  _id: ObjectId;
  sessionId: string;
  timestamp: Date;
  pressureSamples: number[];
  strokePatterns: {
    start: Date;
    end: Date;
    durationMs: number;
  }[];
};

export type StudySession = {
  _id: ObjectId;
  taskId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  focusScores: number[];
  interruptions: number;
  deviceContext: {
    lampSettings: Record<string, any>;
    watchStatus: Record<string, any>;
  };
};
