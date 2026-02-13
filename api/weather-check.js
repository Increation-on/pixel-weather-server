import { kv } from '@vercel/kv';
import { fetchWeatherWithFallback } from '../services/weatherService.js';
import { detectWeatherChanges } from '../utils/weatherDetector.js';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export default async function handler(req, res) {
  // Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('⏰ CRON: Начинаю проверку погоды...');
    
    // 1. Получаем все уникальные локации из Redis
    const locationKeys = await kv.keys('location:*');
    console.log(`📍 Найдено локаций: ${locationKeys.length}`);

    const results = [];

    for (const key of locationKeys) {
      const [_, lat, lon] = key.split(':');
      console.log(`🔍 Проверка: ${lat}, ${lon}`);

      // 2. Получаем текущую погоду
      const weather = await fetchWeatherWithFallback(parseFloat(lat), parseFloat(lon));
      
      // 3. Получаем старый снапшот
      const snapshot = await kv.hgetall(`snapshot:${lat}:${lon}`);
      
      // 4. Детектим изменения
      const changes = detectWeatherChanges(snapshot, weather);
      
      if (changes.length > 0) {
        console.log(`🎯 Изменения для ${lat},${lon}:`, changes);
        
        // 5. Сохраняем новый снапшот
        await kv.hset(`snapshot:${lat}:${lon}`, { 
          ...weather, 
          timestamp: Date.now() 
        });
        
        // 6. Получаем всех пользователей в этой локации
        const tokens = await kv.smembers(key);
        console.log(`📱 Пользователей в локации: ${tokens.length}`);
        
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
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          console.log('✅ Отправлено:', tickets);
        }
        
        results.push({ 
          location: `${lat},${lon}`, 
          changes, 
          users: tokens.length 
        });
      } else {
        console.log(`⏸️ Нет изменений для ${lat},${lon}`);
      }
    }
    
    console.log('✅ CRON завершён');
    res.status(200).json({ 
      success: true, 
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ CRON error:', error);
    res.status(500).json({ error: error.message });
  }
}