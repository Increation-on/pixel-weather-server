// api/update-location.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token, lat, lon } = req.body;
    
    // Сохраняем в Redis
    await kv.hset(`user:${token}`, { lat, lon, lastUpdate: Date.now() });
    
    // Добавляем в группу по координатам
    const locationKey = `location:${lat.toFixed(3)}:${lon.toFixed(3)}`;
    await kv.sadd(locationKey, token);
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}