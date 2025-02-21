import pytest
import asyncio
from utils import APIClient, WebSocketClient
from config import TEST_USER, TEST_DEVICES

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.asyncio
async def test_light_automation(api_client):
    """测试台灯自动化控制"""
    
    # 绑定台灯
    response = api_client.post('/devices/bind', json=TEST_DEVICES['desk_lamp'])
    assert response.status_code == 200
    device_id = response.json()['deviceId']
    
    try:
        # 创建自动化规则
        automation = {
            'trigger': {
                'type': 'env_condition',
                'conditions': [
                    {
                        'type': 'illuminance',
                        'operator': 'less_than',
                        'value': 200
                    }
                ]
            },
            'actions': [
                {
                    'type': 'adjust_light',
                    'deviceId': device_id,
                    'brightness': 80
                }
            ]
        }
        
        response = api_client.post('/system/automations/trigger', json=automation)
        assert response.status_code == 200
        
        # 模拟光线不足的环境数据
        env_data = {
            'deviceId': device_id,
            'illuminance': 150,
            'temperature': 25,
            'humidity': 50,
            'noiseLevel': 40
        }
        
        response = api_client.post('/sensors/env', json=env_data)
        assert response.status_code == 200
        
        # 等待自动化执行
        await asyncio.sleep(2)
        
        # 验证设备状态
        response = api_client.get(f'/devices/{device_id}')
        assert response.status_code == 200
        device_status = response.json()
        assert device_status['settings']['brightness'] == 80
        
    finally:
        # 清理：解绑设备
        api_client.delete(f'/devices/{device_id}')

@pytest.mark.asyncio
async def test_focus_mode_automation(api_client):
    """测试专注模式自动化"""
    
    # 绑定所有设备
    device_ids = {}
    for device_type, device_info in TEST_DEVICES.items():
        response = api_client.post('/devices/bind', json=device_info)
        assert response.status_code == 200
        device_ids[device_type] = response.json()['deviceId']
    
    try:
        # 创建自动化规则
        automation = {
            'trigger': {
                'type': 'time_condition',
                'conditions': [
                    {
                        'type': 'time_range',
                        'start': '09:00',
                        'end': '11:00'
                    }
                ]
            },
            'actions': [
                {
                    'type': 'start_focus_mode',
                    'userId': TEST_USER['id']
                },
                {
                    'type': 'adjust_light',
                    'deviceId': device_ids['desk_lamp'],
                    'brightness': 70
                }
            ]
        }
        
        response = api_client.post('/system/automations/trigger', json=automation)
        assert response.status_code == 200
        
        # 等待自动化执行
        await asyncio.sleep(2)
        
        # 验证是否创建了学习会话
        response = api_client.get('/tasks/current')
        assert response.status_code == 200
        session = response.json()
        assert session is not None
        
        # 验证设备状态
        response = api_client.get(f'/devices/{device_ids["desk_lamp"]}')
        assert response.status_code == 200
        device_status = response.json()
        assert device_status['settings']['brightness'] == 70
        
    finally:
        # 清理：解绑所有设备
        for device_id in device_ids.values():
            api_client.delete(f'/devices/{device_id}')

@pytest.mark.asyncio
async def test_notification_automation(api_client, ws_client):
    """测试通知自动化"""
    
    # 启动WebSocket监听
    ws_task = asyncio.create_task(ws_client.listen())
    
    try:
        # 创建通知自动化规则
        automation = {
            'trigger': {
                'type': 'biometric_condition',
                'conditions': [
                    {
                        'type': 'posture',
                        'operator': 'equals',
                        'value': 'hunched'
                    }
                ]
            },
            'actions': [
                {
                    'type': 'send_notification',
                    'userId': TEST_USER['id'],
                    'message': '请注意保持正确坐姿'
                }
            ]
        }
        
        response = api_client.post('/system/automations/trigger', json=automation)
        assert response.status_code == 200
        
        # 发送不良姿势数据
        biometric_data = {
            'userId': TEST_USER['id'],
            'heartRate': 75,
            'hrv': 50,
            'posture': 'hunched',
            'movementFrequency': 2
        }
        
        response = api_client.post('/sensors/biometric', json=biometric_data)
        assert response.status_code == 200
        
        # 等待通知
        await asyncio.sleep(2)
        
        # 验证通知
        response = api_client.get('/system/notifications')
        assert response.status_code == 200
        notifications = response.json()
        assert len(notifications) > 0
        assert any('坐姿' in n['message'] for n in notifications)
        
        # 验证WebSocket消息
        assert len(ws_client.messages) > 0
        assert any('坐姿' in str(m) for m in ws_client.messages)
        
    finally:
        # 停止WebSocket监听
        ws_task.cancel()
        try:
            await ws_task
        except asyncio.CancelledError:
            pass
