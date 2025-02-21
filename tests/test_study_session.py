import pytest
import asyncio
from utils import APIClient, StudySessionSimulator, WebSocketClient
from config import TEST_USER, TEST_DEVICES

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
async def device_ids(api_client):
    """绑定测试设备并返回设备ID"""
    ids = {}
    
    # 绑定设备
    for device_type, device_info in TEST_DEVICES.items():
        response = api_client.post('/devices/bind', json=device_info)
        assert response.status_code == 200
        ids[device_type] = response.json()['deviceId']
    
    yield ids
    
    # 清理：解绑设备
    for device_id in ids.values():
        api_client.delete(f'/devices/{device_id}')

@pytest.fixture
async def ws_client():
    client = WebSocketClient(TEST_USER['id'])
    await client.connect()
    yield client
    await client.close()

@pytest.mark.asyncio
async def test_complete_study_session(api_client, device_ids, ws_client):
    """测试完整的学习会话流程"""
    
    # 创建学习会话模拟器
    simulator = StudySessionSimulator(api_client, device_ids)
    
    # 启动WebSocket监听
    ws_task = asyncio.create_task(ws_client.listen())
    
    try:
        # 开始学习会话
        session_id = await simulator.start_session()
        assert session_id is not None
        
        # 模拟25分钟的学习过程
        await simulator.simulate_study_period(duration_minutes=1)  # 为了测试快速进行，只模拟1分钟
        
        # 结束会话
        await simulator.end_session()
        
        # 验证学习报告
        response = api_client.post('/analytics/insights/generate', json={
            'startDate': '2025-02-21T00:00:00Z',
            'endDate': '2025-02-22T00:00:00Z'
        })
        assert response.status_code == 200
        
        report = response.json()
        assert 'totalStudyTime' in report
        assert 'averageFocusScore' in report
        assert 'recommendations' in report
        
    finally:
        # 停止WebSocket监听
        ws_task.cancel()
        try:
            await ws_task
        except asyncio.CancelledError:
            pass

@pytest.mark.asyncio
async def test_interruption_handling(api_client, device_ids):
    """测试学习中断处理"""
    
    simulator = StudySessionSimulator(api_client, device_ids)
    
    # 开始会话
    session_id = await simulator.start_session()
    
    # 模拟一段时间的学习
    await simulator.simulate_study_period(duration_minutes=0.5)  # 30秒
    
    # 暂停会话
    response = api_client.post(f'/tasks/{session_id}/pause')
    assert response.status_code == 200
    
    # 等待一段时间
    await asyncio.sleep(5)
    
    # 继续会话
    await simulator.simulate_study_period(duration_minutes=0.5)  # 再学习30秒
    
    # 结束会话
    await simulator.end_session()
    
    # 验证专注度分析
    response = api_client.get('/analytics/focus-level')
    assert response.status_code == 200
    assert 'score' in response.json()

@pytest.mark.asyncio
async def test_environment_monitoring(api_client, device_ids):
    """测试环境监控功能"""
    
    # 上报不良环境数据
    bad_env_data = {
        'deviceId': device_ids['desk_lamp'],
        'illuminance': 50,  # 光线太暗
        'temperature': 30,  # 温度太高
        'humidity': 80,    # 湿度太高
        'noiseLevel': 80   # 噪音太大
    }
    
    response = api_client.post('/sensors/env', json=bad_env_data)
    assert response.status_code == 200
    
    # 验证是否触发了自动化规则
    response = api_client.get('/system/notifications')
    assert response.status_code == 200
    
    notifications = response.json()
    assert len(notifications) > 0
    
    # 至少应该有一个环境相关的通知
    env_notifications = [n for n in notifications if '环境' in n['message']]
    assert len(env_notifications) > 0

@pytest.mark.asyncio
async def test_posture_monitoring(api_client, device_ids):
    """测试姿势监控功能"""
    
    # 连续发送不良姿势数据
    bad_posture_data = {
        'userId': TEST_USER['id'],
        'heartRate': 75,
        'hrv': 50,
        'posture': 'hunched',
        'movementFrequency': 2
    }
    
    # 发送3次不良姿势数据
    for _ in range(3):
        response = api_client.post('/sensors/biometric', json=bad_posture_data)
        assert response.status_code == 200
        await asyncio.sleep(1)
    
    # 检查姿势状态
    response = api_client.get('/analytics/posture')
    assert response.status_code == 200
    
    posture_data = response.json()
    assert posture_data['needsReminder'] is True
    assert posture_data['currentPosture'] == 'hunched'
