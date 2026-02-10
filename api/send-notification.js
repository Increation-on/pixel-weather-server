const { getMessaging } = require('../lib/firebase.js');
const addCorsHeaders = require('./_cors.js');

// Определение приоритета по изменениям погоды
function determinePriority(changes) {
  if (!Array.isArray(changes)) return 'default';
  
  const changesText = changes.join(' ').toLowerCase();
  
  // HIGH приоритет
  const highKeywords = ['гроза', 'ураган', 'шторм', 'ливень', 'сильный', 'экстрен', '⚠️', '⚡'];
  if (highKeywords.some(keyword => changesText.includes(keyword))) {
    return 'high';
  }
  
  // DEFAULT приоритет  
  const defaultKeywords = ['температура', 'дождь', 'снег', 'туман', 'ветер', 'изменен', '↑', '↓'];
  if (defaultKeywords.some(keyword => changesText.includes(keyword))) {
    return 'default';
  }
  
  return 'low';
}

// Проверка "тихих часов" (23:00 - 07:00)
function isQuietHours() {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 23 || hours < 7;
}

// Простая защита от спама (максимум 1 уведомление в час на токен)
const sentNotifications = new Map(); // В продакшене используйте Redis или БД

function canSendNotification(fcmToken) {
  const lastSent = sentNotifications.get(fcmToken);
  if (!lastSent) return true;
  
  const hourAgo = Date.now() - (60 * 60 * 1000);
  return lastSent < hourAgo;
}

function updateNotificationTimestamp(fcmToken) {
  sentNotifications.set(fcmToken, Date.now());
}

module.exports = async function handler(req, res) {
  // CORS headers
  if (addCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      fcmToken, 
      changes = [],           // ["Температура +5°C", "Начался дождь"]
      location = {},          // { lat: 55.7558, lon: 37.6176, name: "Москва" }
      priority,               // Опционально: 'high' | 'default' | 'low'
      source = 'weather_service', // Откуда пришел запрос
      data = {}
    } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    // Проверка "тихих часов"
    if (isQuietHours()) {
      console.log('🌙 Тихие часы (23:00-07:00), пропускаем уведомление');
      return res.status(200).json({ 
        success: true,
        message: 'Notification skipped (quiet hours)',
        skipped: true,
        reason: 'quiet_hours'
      });
    }

    // Защита от спама
    if (!canSendNotification(fcmToken)) {
      console.log('⏱️ Слишком часто для токена, пропускаем');
      return res.status(200).json({ 
        success: true,
        message: 'Notification skipped (rate limit)',
        skipped: true,
        reason: 'rate_limit'
      });
    }

    // Определяем приоритет
    const finalPriority = priority || determinePriority(changes);
    const channelId = `pixel_weather_${finalPriority}`;
    
    // Формируем заголовок и текст
    let title, body;
    
    if (finalPriority === 'high') {
      title = '⚠️ PIXEL WEATHER - ВНИМАНИЕ!';
      body = changes.length > 0 
        ? changes[0] 
        : 'Экстренное погодное предупреждение';
    } else {
      title = '🌤️ PIXEL WEATHER';
      body = changes.length > 0 
        ? (changes.length === 1 ? changes[0] : `Изменений: ${changes.length}`)
        : 'Обновление погоды';
    }

    console.log(`📤 Погодное уведомление: ${finalPriority} приоритет`);
    console.log(`📝 Изменения:`, changes);
    console.log(`📍 Локация:`, location);
    console.log(`📱 Источник: ${source}`);

    const messaging = getMessaging();

    const message = {
      token: fcmToken,
      
      data: {
        title: title,
        body: body,
        channel_id: channelId,
        
        // Метаданные
        type: 'weather_change',
        priority: finalPriority,
        timestamp: new Date().toISOString(),
        source: source,
        
        // Данные для клиента
        changes: JSON.stringify(changes),
        location: JSON.stringify(location),
        
        // Для Android
        android_channel_id: channelId,
        sound: finalPriority === 'low' ? null : 'default',
        
        // Дополнительные данные
        ...data
      },
      
      android: {
        priority: finalPriority === 'high' ? 'high' : 'normal',
        ttl: 3600000 // 1 час
      },
      
      apns: {
        headers: {
          "apns-priority": finalPriority === 'high' ? "10" : "5"
        },
        payload: {
          aps: {
            sound: finalPriority === 'low' ? null : "default",
            badge: 1,
            contentAvailable: 1,
            mutableContent: 1
          }
        }
      }
    };

    console.log('📤 Отправка погодного уведомления...');

    const response = await messaging.send(message);
    
    // Обновляем timestamp для защиты от спама
    updateNotificationTimestamp(fcmToken);
    
    console.log('✅ Уведомление отправлено:', response);

    return res.status(200).json({ 
      success: true,
      message: 'Weather notification sent',
      messageId: response,
      priority: finalPriority,
      channelId: channelId,
      changesCount: changes.length,
      sentAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Ошибка отправки уведомления:', error);
    return res.status(500).json({ 
      error: 'Failed to send notification',
      details: error.message,
      code: error.code
    });
  }
};