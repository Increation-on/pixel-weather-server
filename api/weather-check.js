import { kv } from '@vercel/kv';
import { fetchWeatherWithFallback } from '../services/weatherService.js';
import { 
  detectWeatherChanges, 
  checkEmergencyWeather,
  getWeatherCategory 
} from '../utils/weatherDetector.js';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('⏰ CRON: Начинаю проверку погоды...');
    
    // 1. Получаем ВСЕ уникальные локации
    const locationKeys = await kv.keys('location:*');
    console.log(`📍 Найдено локаций в БД: ${locationKeys.length}`);

    const results = [];

    for (const key of locationKeys) {
      const [_, lat, lon] = key.split(':');
      
      // 2. Получаем ВСЕ токены для этой локации
      const tokens = await kv.smembers(key);
      
      if (tokens.length === 0) {
        console.log(`⚠️ Локация ${lat},${lon} без токенов — удаляем`);
        await kv.del(key);
        continue;
      }

      // 3. Для КАЖДОГО токена проверяем, является ли эта локация текущей
      let hasActiveUsers = false;
      
      for (const token of tokens) {
        const userLocation = await kv.get(`user:${token}:current`);
        
        // Если у пользователя есть текущая локация И она совпадает с этой
        if (userLocation && 
            Math.abs(userLocation.lat - parseFloat(lat)) < 0.001 && 
            Math.abs(userLocation.lon - parseFloat(lon)) < 0.001) {
          hasActiveUsers = true;
          console.log(`✅ Токен ${token.substring(0, 10)}... активен для этой локации`);
        } else {
          console.log(`🗑️ Токен ${token.substring(0, 10)}... устарел — удаляем`);
          await kv.srem(key, token);
        }
      }
      
      // Если после фильтрации не осталось активных пользователей — пропускаем локацию
      if (!hasActiveUsers) {
        console.log(`⏸️ Локация ${lat},${lon} не имеет активных пользователей — пропускаем`);
        
        // Если локация опустела — удаляем её
        const remainingTokens = await kv.smembers(key);
        if (remainingTokens.length === 0) {
          await kv.del(key);
        }
        continue;
      }

      console.log(`🔍 Проверка активной локации: ${lat}, ${lon}`);

      // 4. Получаем текущую погоду
      const weather = await fetchWeatherWithFallback(parseFloat(lat), parseFloat(lon));
      
      // 5. Получаем старый снапшот
      const snapshot = await kv.hgetall(`snapshot:${lat}:${lon}`);
      
      // 6. 🔥 ЕСЛИ СНЭПШОТА НЕТ — СОЗДАЁМ И ПРОПУСКАЕМ
      if (!snapshot || Object.keys(snapshot).length === 0) {
        console.log(`📸 Первый запуск для ${lat},${lon} — сохраняем снапшот`);
        await kv.hset(`snapshot:${lat}:${lon}`, { 
          ...weather, 
          timestamp: Date.now() 
        });
        
        results.push({ 
          location: `${lat},${lon}`, 
          status: 'initialized',
          users: tokens.length 
        });
        
        continue;
      }

      // 7. ДЕТАЛЬНЫЕ ЛОГИ ДЛЯ ОТЛАДКИ
      console.log('===== СРАВНЕНИЕ =====');
      console.log('📦 Снапшот:', {
        temp: snapshot.temperature,
        wind: snapshot.windSpeed,
        code: snapshot.weatherCode,
        source: snapshot.source
      });
      console.log('🌤️ Текущее:', {
        temp: weather.temperature,
        wind: weather.windSpeed,
        code: weather.weatherCode,
        source: weather.source
      });

      // 8. ПРОВЕРЯЕМ ЭКСТРЕННЫЕ
      const emergencyAlerts = checkEmergencyWeather(weather);
      
      if (emergencyAlerts.length > 0) {
        console.log(`🚨 ЭКСТРЕННЫЕ для ${lat},${lon}:`, emergencyAlerts);
        
        for (const alert of emergencyAlerts) {
          const emergencyMessages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title: alert.title,
            body: alert.body,
            data: { 
              type: 'emergency',
              level: alert.level,
              emergencyType: alert.type,
              weather 
            },
            priority: alert.priority === 'high' ? 'high' : 'normal',
            android: {
              channelId: alert.priority === 'high' ? 'pixel_weather_emergency' : 'pixel_weather_high',
              priority: alert.priority === 'high' ? 'high' : 'normal',
              sound: 'default',
              vibrationPattern: alert.priority === 'high' ? [500, 500, 1000] : undefined
            }
          }));
          
          const chunks = expo.chunkPushNotifications(emergencyMessages);
          for (const chunk of chunks) {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            console.log('✅ Экстренное отправлено:', tickets);
          }
        }
        
        // Сохраняем снапшот после экстренного
        await kv.hset(`snapshot:${lat}:${lon}`, { 
          ...weather, 
          timestamp: Date.now(),
          lastEmergency: Date.now()
        });
        
        results.push({ 
          location: `${lat},${lon}`, 
          emergencies: emergencyAlerts.map(e => ({ level: e.level, type: e.type })),
          users: tokens.length 
        });
        
        continue;
      }

      // 9. ПРОВЕРЯЕМ ОБЫЧНЫЕ ИЗМЕНЕНИЯ
      const changes = detectWeatherChanges(snapshot, weather);
      
      if (changes.length > 0) {
        console.log(`🎯 Изменения для ${lat},${lon}:`, changes);
        
        // Сохраняем новый снапшот
        await kv.hset(`snapshot:${lat}:${lon}`, { 
          ...weather, 
          timestamp: Date.now() 
        });
        
        // Отправляем уведомления
        const changeTexts = changes.map(c => c.text);
        const notificationBody = changeTexts.slice(0, 2).join(' • ');
        
        const messages = tokens.map(token => ({
          to: token,
          sound: 'default',
          title: '🌤️ Pixel Weather',
          body: notificationBody,
          data: { 
            type: 'weather_change',
            changes: changeTexts,
            lat, lon 
          },
          priority: 'normal'
        }));
        
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          console.log('✅ Уведомления отправлены:', tickets);
        }
        
        results.push({ 
          location: `${lat},${lon}`, 
          changes: changeTexts, 
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