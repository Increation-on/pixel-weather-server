import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, lat, lon } = req.body;
    
    if (!token || !lat || !lon) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📍 Установка текущей локации для токена ${token.substring(0, 10)}...: ${lat}, ${lon}`);

    // 🔥 1. Удаляем токен из ВСЕХ существующих локаций
    const allLocationKeys = await kv.keys('location:*');
    for (const key of allLocationKeys) {
      await kv.srem(key, token);
    }
    console.log(`🗑️ Токен удалён из всех старых локаций`);

    // 2. Добавляем токен в НОВУЮ локацию
    await kv.sadd(`location:${lat}:${lon}`, token);
    console.log(`✅ Токен добавлен в локацию ${lat},${lon}`);

    // 3. Сохраняем текущую локацию пользователя
    await kv.set(`user:${token}:current`, { 
      lat, 
      lon, 
      updatedAt: Date.now() 
    });

    console.log(`✅ Текущая локация сохранена`);

    res.status(200).json({ 
      success: true, 
      message: 'Current location updated',
      location: { lat, lon }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
}