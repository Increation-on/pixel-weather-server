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
const sentNotifications = new Map();

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
    
    // 🔴 ФОРМИРУЕМ ЗАГОЛОВОК И ТЕКСТ ПРАВИЛЬНО
    let notificationTitle, notificationBody;
    
    if (finalPriority === 'high') {
      notificationTitle = '⚠️ PIXEL WEATHER - ВНИМАНИЕ!';
      notificationBody = changes.length > 0 
        ? String(changes[0]) 
        : 'Экстренное погодное предупреждение';
    } else {
      notificationTitle = '🌤️ PIXEL WEATHER';
      notificationBody = changes.length > 0 
        ? (changes.length === 1 ? String(changes[0]) : `Изменений: ${changes.length}`)
        : 'Обновление погоды';
    }

    console.log(`📤 Погодное уведомление: ${finalPriority} приоритет`);
    console.log(`📝 Изменения:`, changes);
    console.log(`📍 Локация:`, location);
    console.log(`📱 Источник: ${source}`);

    const messaging = getMessaging();

    // 🔴 КРИТИЧЕСКИ ВАЖНО: ПРАВИЛЬНЫЙ ФОРМАТ СООБЩЕНИЯ
    const message = {
      token: fcmToken,
      
      // 🔴 ДЛЯ ПОКАЗА УВЕДОМЛЕНИЯ (работает всегда)
      notification: {
        title: notificationTitle,
        body: notificationBody
      },
      
      // 🔴 ДЛЯ ПЕРЕДАЧИ ДАННЫХ В ПРИЛОЖЕНИЕ (работает в фоне)
      data: {
        // Метаданные
        type: 'weather_change',
        priority: String(finalPriority),
        timestamp: new Date().toISOString(),
        source: String(source),
        
        // Данные для клиента
        changes: JSON.stringify(changes), // JSON строка
        location: JSON.stringify(location), // JSON строка
        
        // Для вашего кода на клиенте (опционально)
        android_channel_id: String(channelId),
        
        // 🔴 ВАЖНО: не дублируем title и body здесь
        // они уже в notification
      },
      
      // 🔴 НАСТРОЙКИ ДЛЯ ANDROID
      android: {
        priority: finalPriority === 'high' ? 'high' : 'normal',
        ttl: 3600000, // 1 час
        notification: {
          channel_id: channelId, // 🔴 Ключевое для Android 8+
          icon: 'notification_icon',
          color: '#4ecdc4',
          sound: finalPriority !== 'low' ? 'default' : null,
          tag: 'weather_update'
        }
      },
      
      // 🔴 НАСТРОЙКИ ДЛЯ iOS
      apns: {
        headers: {
          "apns-priority": finalPriority === 'high' ? "10" : "5",
          "apns-push-type": "alert"
        },
        payload: {
          aps: {
            alert: {
              title: notificationTitle,
              body: notificationBody
            },
            sound: finalPriority !== 'low' ? "default" : undefined,
            badge: 1,
            'content-available': 1, // 🔴 КРИТИЧЕСКИ для фоновых сообщений
            'mutable-content': 1
          }
        }
      },
      
      // 🔴 WEB (если нужно)
      webpush: {
        headers: {
          Urgency: finalPriority === 'high' ? 'high' : 'normal'
        }
      }
    };

    console.log('📤 Отправка погодного уведомления...');
    console.log('📦 Формат сообщения:', {
      hasNotification: !!message.notification,
      hasData: !!message.data,
      androidPriority: message.android.priority,
      iosContentAvailable: message.apns.payload.aps['content-available']
    });

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
      sentAt: new Date().toISOString(),
      format: 'notification+data' // Указываем что отправили оба формата
    });

  } catch (error) {
    console.error('❌ Ошибка отправки уведомления:', error);
    console.error('Полная ошибка:', {
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      error: 'Failed to send notification',
      details: error.message,
      code: error.code,
      tip: 'Проверьте формат сообщения (notification + data)'
    });
  }
};