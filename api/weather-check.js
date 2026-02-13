// api/cron-weather-check.js (новый файл)
import { kv } from '@vercel/kv';
import { fetchWeatherWithFallback } from '../services/weatherService.js';
import { detectWeatherChanges } from '../utils/weatherDetector.js';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405);

  try {
    // 1. Получаем ВСЕ уникальные локации
    const locationKeys = await kv.keys('location:*');
    
    for (const key of locationKeys) {
      const [_, lat, lon] = key.split(':');
      
      // 2. Получаем погоду
      const weather = await fetchWeatherWithFallback(parseFloat(lat), parseFloat(lon));
      
      // 3. Получаем старый снапшот
      const snapshot = await kv.hgetall(`snapshot:${lat}:${lon}`);
      
      // 4. Детектим изменения
      const changes = detectWeatherChanges(snapshot, weather);
      
      if (changes.length > 0) {
        // 5. Сохраняем новый снапшот
        await kv.hset(`snapshot:${lat}:${lon}`, { ...weather, timestamp: Date.now() });
        
        // 6. Получаем всех пользователей в этой локации
        const tokens = await kv.smembers(key);
        
        // 7. Отправляем уведомления
        const messages = tokens.map(token => ({
          to: token,
          sound: 'default',
          title: '🌤️ Pixel Weather',
          body: changes.slice(0, 2).join(' • '),
          data: { changes, lat, lon }
        }));
        
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          await expo.sendPushNotificationsAsync(chunk);
        }
      }
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}