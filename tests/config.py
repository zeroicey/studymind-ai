import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# API配置
API_BASE_URL = 'http://localhost:3000'
WS_BASE_URL = 'ws://localhost:3001'

# 测试用户配置
TEST_USER = {
    'id': '1234567890',
    'username': 'test_student',
    'role': 'student'
}

# JWT配置
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')

# 设备配置
TEST_DEVICES = {
    'desk_lamp': {
        'type': 'desk_lamp',
        'vendor': 'xiaomi',
        'capabilities': {
            'envSensing': True
        }
    },
    'smartwatch': {
        'type': 'smartwatch',
        'vendor': 'huawei',
        'capabilities': {
            'healthMonitoring': True
        }
    },
    'stylus': {
        'type': 'stylus',
        'vendor': 'wacom',
        'capabilities': {
            'pressureDetection': True
        }
    }
}

# 环境数据范围
ENV_DATA_RANGES = {
    'illuminance': (200, 1000),  # 照度（勒克斯）
    'temperature': (20, 26),     # 温度（摄氏度）
    'humidity': (40, 60),        # 湿度（%）
    'noiseLevel': (30, 70)       # 噪音（分贝）
}

# 生物数据范围
BIOMETRIC_RANGES = {
    'heartRate': (60, 100),      # 心率（次/分钟）
    'hrv': (20, 100),           # 心率变异性
    'movementFrequency': (0, 10) # 动作频率（次/分钟）
}

# 学习会话配置
STUDY_SESSION_CONFIG = {
    'minDuration': 25 * 60,      # 最短专注时间（秒）
    'maxDuration': 45 * 60,      # 最长专注时间（秒）
    'breakDuration': 5 * 60      # 休息时间（秒）
}
