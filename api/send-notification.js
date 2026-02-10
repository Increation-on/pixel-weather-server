const { getMessaging } = require('../lib/firebase.js');
const addCorsHeaders = require('./_cors.js');

function determinePriority(changes) {
  if (!Array.isArray(changes)) return 'default';
  
  const changesText = changes.join(' ').toLowerCase();
  
  const highKeywords = ['гроза', 'ураган', 'шторм', 'ливень', 'сильный', 'экстрен', '⚠️', '⚡'];
  if (highKeywords.some(keyword => changesText.includes(keyword))) {
    return 'high';
  }
  
  const defaultKeywords = ['температура', 'дождь', 'снег', 'туман', 'ветер', 'изменен', '↑', '↓'];
  if (defaultKeywords.some(keyword => changesText.includes(keyword))) {
    return 'default';
  }
  
  return 'low';
}

function isQuietHours() {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 23 || hours < 7;
}

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
  if (addCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      fcmToken, 
      changes = [],
      location = {},
      priority,
      source = 'weather_service',
      data = {}
    } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    // Пропускаем проверку тихих часов для тестов
    // if (isQuietHours()) {
    //   console.log('🌙 Тихие часы, пропускаем');
    //   return res.status(200).json({ 
    //     success: true,
    //     message: 'Notification skipped (quiet hours)',
    //     skipped: true,
    //     reason: 'quiet_hours'
    //   });
    // }

    // Временно отключаем защиту от спама для тестов
    // if (!canSendNotification(fcmToken)) {
    //   console.log('⏱️ Слишком часто, пропускаем');
    //   return res.status(200).json({ 
    //     success: true,
    //     message: 'Notification skipped (rate limit)',
    //     skipped: true,
    //     reason: 'rate_limit'
    //   });
    // }

    const finalPriority = priority || determinePriority(changes);
    const channelId = `pixel_weather_${finalPriority}`;
    
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

    const messaging = getMessaging();

    // 🔴 ИСПРАВЛЕННЫЙ ФОРМАТ - КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ:
    const message = {
      token: fcmToken,
      
      // ✅ notification для показа уведомления
      notification: {
        title: notificationTitle,
        body: notificationBody
      },
      
      // ✅ data для передачи в приложение
      data: {
        type: 'weather_change',
        priority: String(finalPriority),
        timestamp: new Date().toISOString(),
        source: String(source),
        changes: JSON.stringify(changes),
        location: JSON.stringify(location),
        // Для отладки - флаг теста фоновых уведомлений
        test_mode: 'background_test',
        // Ключ для проверки в AsyncStorage
        debug_key: 'bg_test_' + Date.now()
      },
      
      // ✅ КРИТИЧЕСКИЕ НАСТРОЙКИ ДЛЯ ФОНА
      android: {
        priority: 'high', // 🔴 ВСЕГДА high для фоновых уведомлений
        ttl: 3600000,
        notification: {
          channel_id: channelId,
          icon: 'notification_icon',
          color: '#4ecdc4',
          sound: finalPriority !== 'low' ? 'default' : null,
          tag: 'weather_update'
        }
      },
      
      // ✅ КРИТИЧЕСКИЕ НАСТРОЙКИ ДЛЯ iOS
      apns: {
        headers: {
          "apns-priority": "10", // 🔴 ВСЕГДА 10 для фоновых уведомлений
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
            'content-available': 1 // 🔴 ОБЯЗАТЕЛЬНО
          },
          // 🔴 ДАННЫЕ ДЛЯ iOS (в отдельном объекте, а не в aps)
          type: 'weather_change',
          priority: String(finalPriority),
          test_mode: 'background_test'
        }
      }
    };

    console.log('📤 Отправка уведомления...');
    console.log('📦 Критические настройки:', {
      androidPriority: message.android.priority,
      iosApnsPriority: message.apns.headers["apns-priority"],
      iosContentAvailable: message.apns.payload.aps['content-available'],
      hasNotification: !!message.notification,
      hasData: !!message.data
    });

    const response = await messaging.send(message);
    
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
      format: 'notification+data',
      androidPriority: message.android.priority,
      iosApnsPriority: message.apns.headers["apns-priority"]
    });

  } catch (error) {
    console.error('❌ Ошибка отправки:', error);
    console.error('Полная ошибка:', error);
    
    return res.status(500).json({ 
      error: 'Failed to send notification',
      details: error.message,
      code: error.code
    });
  }
};