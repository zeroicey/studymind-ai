import jwt
import random
import asyncio
import websockets
from datetime import datetime, timedelta
import requests
from config import (
    API_BASE_URL, JWT_SECRET, TEST_USER,
    ENV_DATA_RANGES, BIOMETRIC_RANGES
)

class APIClient:
    def __init__(self):
        self.base_url = API_BASE_URL
        self.token = self._generate_token()
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        })

    def _generate_token(self):
        return jwt.encode(TEST_USER, JWT_SECRET, algorithm='HS256')

    def get(self, endpoint, **kwargs):
        return self.session.get(f'{self.base_url}{endpoint}', **kwargs)

    def post(self, endpoint, **kwargs):
        return self.session.post(f'{self.base_url}{endpoint}', **kwargs)

    def delete(self, endpoint, **kwargs):
        return self.session.delete(f'{self.base_url}{endpoint}', **kwargs)

class DataGenerator:
    @staticmethod
    def generate_env_data(device_id):
        return {
            'deviceId': device_id,
            'illuminance': random.uniform(*ENV_DATA_RANGES['illuminance']),
            'temperature': random.uniform(*ENV_DATA_RANGES['temperature']),
            'humidity': random.uniform(*ENV_DATA_RANGES['humidity']),
            'noiseLevel': random.uniform(*ENV_DATA_RANGES['noiseLevel'])
        }

    @staticmethod
    def generate_biometric_data(user_id):
        return {
            'userId': user_id,
            'heartRate': random.uniform(*BIOMETRIC_RANGES['heartRate']),
            'hrv': random.uniform(*BIOMETRIC_RANGES['hrv']),
            'posture': random.choice(['good', 'hunched']),
            'movementFrequency': random.uniform(*BIOMETRIC_RANGES['movementFrequency'])
        }

    @staticmethod
    def generate_pen_data(session_id):
        num_samples = random.randint(50, 200)
        return {
            'sessionId': session_id,
            'pressureSamples': [random.uniform(0, 1) for _ in range(num_samples)],
            'strokePatterns': [
                {
                    'start': (datetime.now() - timedelta(seconds=random.randint(1, 60))).isoformat(),
                    'end': datetime.now().isoformat(),
                    'durationMs': random.randint(100, 2000)
                }
                for _ in range(random.randint(1, 5))
            ]
        }

class StudySessionSimulator:
    def __init__(self, api_client, device_ids):
        self.api = api_client
        self.device_ids = device_ids
        self.data_generator = DataGenerator()
        self.session_id = None

    async def start_session(self):
        # 开始学习会话
        response = self.api.post('/tasks/start', json={
            'type': 'focus_study',
            'duration': 25 * 60  # 25分钟
        })
        self.session_id = response.json()['sessionId']
        return self.session_id

    async def simulate_study_period(self, duration_minutes=25):
        if not self.session_id:
            await self.start_session()

        end_time = datetime.now() + timedelta(minutes=duration_minutes)
        
        while datetime.now() < end_time:
            # 模拟环境数据上报
            self.api.post('/sensors/env', json=self.data_generator.generate_env_data(
                self.device_ids['desk_lamp']
            ))

            # 模拟生物数据上报
            self.api.post('/sensors/biometric', json=self.data_generator.generate_biometric_data(
                TEST_USER['id']
            ))

            # 模拟笔记数据上报
            self.api.post('/sensors/pen', json=self.data_generator.generate_pen_data(
                self.session_id
            ))

            # 等待5秒
            await asyncio.sleep(5)

    async def end_session(self):
        if self.session_id:
            self.api.post(f'/tasks/{self.session_id}/complete')
            self.session_id = None

class WebSocketClient:
    def __init__(self, user_id):
        self.user_id = user_id
        self.ws = None
        self.messages = []

    async def connect(self):
        uri = f'ws://localhost:3001?userId={self.user_id}'
        self.ws = await websockets.connect(uri)

    async def listen(self):
        while True:
            try:
                message = await self.ws.recv()
                self.messages.append(message)
            except websockets.ConnectionClosed:
                break

    async def close(self):
        if self.ws:
            await self.ws.close()
