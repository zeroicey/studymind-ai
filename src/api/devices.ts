import { Hono } from 'hono';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../config/database';
import { Device } from '../models/types';
import { validateRequest, schemas } from '../middleware/validator';

// 定义验证数据类型
interface ValidatedData {
  deviceType: string;
  deviceId: string;
  userId: string;
  name: string;
}

// 定义环境变量类型
interface Env {
  Variables: {
    validatedData: ValidatedData;
  };
}

const devices = new Hono<Env>();

// 设备绑定
devices.post('/bind', validateRequest(schemas.deviceBind), async (c) => {
  const db = await connectToDatabase();
  const data = c.get('validatedData');
  
  const device: Partial<Device> = {
    ...data,
    status: 'offline',
    lastHeartbeat: new Date()
  };

  const result = await db.collection('devices').insertOne(device);
  return c.json({ success: true, deviceId: result.insertedId.toString() });
});

// 获取在线设备列表
devices.get('/connected', async (c) => {
  const db = await connectToDatabase();
  const devices = await db.collection('devices')
    .find({ status: 'online' })
    .toArray();

  return c.json(devices.map(d => ({
    ...d,
    _id: d._id.toString()
  })));
});

// 获取单个设备
devices.get('/:id', async (c) => {
  const db = await connectToDatabase();
  const id = c.req.param('id');
  
  const device = await db.collection('devices').findOne({
    _id: new ObjectId(id)
  });
  
  if (!device) {
    return c.json({ error: 'Device not found' }, 404);
  }
  
  return c.json({
    ...device,
    _id: device._id.toString()
  });
});

// 解绑设备
devices.delete('/:id', async (c) => {
  const db = await connectToDatabase();
  const id = c.req.param('id');
  
  await db.collection('devices').deleteOne({
    _id: new ObjectId(id)
  });
  
  return c.json({ success: true });
});

export default devices;
