// pixel-weather-server/api/weather-check.js
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
      
      // 🔥 ДОБАВЛЯЕМ ДЕТАЛЬНЫЕ ЛОГИ ЗДЕСЬ 🔥
      console.log('===== ДЕТЕКТОР =====');
      console.log('📦 Старый снапшот:', {
        temperature: snapshot?.temperature,
        windSpeed: snapshot?.windSpeed,
        weatherCode: snapshot?.weatherCode,
        precipitation: snapshot?.precipitation,
        source: snapshot?.source,
        timestamp: snapshot?.timestamp ? new Date(snapshot.timestamp).toISOString() : null
      });

      console.log('🌤️ Текущая погода:', {
        temperature: weather?.temperature,
        windSpeed: weather?.windSpeed,
        weatherCode: weather?.weatherCode,
        precipitation: weather?.precipitation,
        source: weather?.source,
        isFallback: weather?.isFallback
      });

      // Сравниваем температуру
      if (snapshot?.temperature !== undefined && weather?.temperature !== undefined) {
        const tempDiff = Math.abs(weather.temperature - snapshot.temperature);
        console.log(`🌡️ Разница температуры: ${tempDiff.toFixed(2)}°C (порог 5°C)`);
      }

      // Сравниваем категории (используем функцию из weatherDetector)
      const oldCat = snapshot?.weatherCode ? getWeatherCategory(snapshot.weatherCode) : 'нет данных';
      const newCat = weather?.weatherCode ? getWeatherCategory(weather.weatherCode) : 'нет данных';
      console.log(`☁️ Категория: "${oldCat}" → "${newCat}"`);
      console.log(`📊 Коды: ${snapshot?.weatherCode} → ${weather?.weatherCode}`);

      // Сравниваем ветер
      if (snapshot?.windSpeed !== undefined && weather?.windSpeed !== undefined) {
        const windDiff = Math.abs(weather.windSpeed - snapshot.windSpeed);
        console.log(`💨 Разница ветра: ${windDiff.toFixed(2)} м/с (порог 5 м/с)`);
      }

      // Сравниваем осадки
      if (snapshot?.precipitation !== undefined && weather?.precipitation !== undefined) {
        const precipDiff = weather.precipitation - snapshot.precipitation;
        if (Math.abs(precipDiff) > 0.1) {
          console.log(`💧 Осадки изменились: ${snapshot.precipitation} → ${weather.precipitation} мм`);
        }
      }
      console.log('=====================');
      
      // 4. ПОЛУЧАЕМ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ В ЭТОЙ ЛОКАЦИИ
      const tokens = await kv.smembers(key);
      
      if (tokens.length === 0) continue;
      
      // 5. 🔥 ПРОВЕРЯЕМ НА ЭКСТРЕННЫЕ ЯВЛЕНИЯ (В ПЕРВУЮ ОЧЕРЕДЬ!)
      const emergencyAlerts = checkEmergencyWeather(weather);
      
      if (emergencyAlerts.length > 0) {
        console.log(`🚨 ЭКСТРЕННЫЕ УВЕДОМЛЕНИЯ для ${lat},${lon}:`, emergencyAlerts);
        
        // Отправляем каждое экстренное уведомление
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
              weather: weather 
            },
            // 🔥 Высокий приоритет для экстренных
            priority: alert.priority === 'high' ? 'high' : 'normal',
            
            // 📱 Android: специальный канал
            android: {
              channelId: alert.priority === 'high' ? 'pixel_weather_emergency' : 'pixel_weather_high',
              priority: alert.priority === 'high' ? 'high' : 'normal',
              sound: 'default',
              vibrationPattern: alert.priority === 'high' ? [500, 500, 1000] : undefined
            },
            
            // 🍎 iOS: пробивает без звука
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  'content-available': 1,
                  'interruption-level': alert.priority === 'high' ? 'time-sensitive' : 'active'
                }
              }
            }
          }));
          
          const chunks = expo.chunkPushNotifications(emergencyMessages);
          for (const chunk of chunks) {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            console.log('✅ Экстренное отправлено:', tickets);
          }
        }
        
        // 🔥 Сохраняем экстренный снапшот отдельно (чтобы не дублировать)
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
        
        // Пропускаем обычные уведомления, если были экстренные
        continue;
      }
      
      // 6. ЕСЛИ НЕТ ЭКСТРЕННЫХ - ПРОВЕРЯЕМ ОБЫЧНЫЕ ИЗМЕНЕНИЯ
      const changes = detectWeatherChanges(snapshot, weather);
      
      if (changes.length > 0) {
        console.log(`🎯 Изменения для ${lat},${lon}:`, changes);
        
        // Сохраняем новый снапшот
        await kv.hset(`snapshot:${lat}:${lon}`, { 
          ...weather, 
          timestamp: Date.now() 
        });
        
        // Формируем текст уведомления (первые 2 изменения)
        const changeTexts = changes.map(c => c.text);
        const notificationBody = changeTexts.slice(0, 2).join(' • ');
        
        // Отправляем уведомления
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
          // Обычный приоритет
          priority: 'normal',
          android: {
            channelId: 'pixel_weather_default'
          }
        }));
        
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          console.log('✅ Обычные уведомления отправлены:', tickets);
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