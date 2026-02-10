const { getMessaging } = require('../lib/firebase.js');
const addCorsHeaders = require('./_cors.js');

module.exports = async function handler(req, res) {
  if (addCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      fcmToken, 
      title = 'PIXEL WEATHER - ТЕСТ', 
      body = '✅ Тестовое уведомление работает!',
      channelId = 'pixel_weather_default',
      data = {},
      priority = 'default'
    } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    console.log(`📤 Тест: Отправка на ${fcmToken.substring(0, 20)}...`);
    console.log(`🎯 Канал: ${channelId}, Приоритет: ${priority}`);

    const messaging = getMessaging();

    // 🔴 ПРАВИЛЬНЫЙ ФОРМАТ: notification + data
    const message = {
      token: fcmToken,
      
      // Для показа уведомления
      notification: {
        title: String(title),
        body: String(body)
      },
      
      // Для передачи данных
      data: {
        type: 'test',
        source: 'server_test',
        timestamp: new Date().toISOString(),
        priority: String(priority),
        android_channel_id: String(channelId),
        ...data // Любые дополнительные данные
      },
      
      android: {
        priority: channelId.includes('high') ? 'high' : 'normal',
        ttl: 3600000,
        notification: {
          channel_id: channelId,
          icon: 'notification_icon',
          color: '#4ecdc4',
          sound: channelId !== 'pixel_weather_low' ? 'default' : null
        }
      },
      
      apns: {
        headers: {
          "apns-priority": channelId.includes('high') ? "10" : "5",
          "apns-push-type": "alert"
        },
        payload: {
          aps: {
            alert: {
              title: String(title),
              body: String(body)
            },
            sound: channelId !== 'pixel_weather_low' ? "default" : undefined,
            badge: 1,
            'content-available': 1,
            'mutable-content': 1
          }
        }
      }
    };

    console.log('📤 Отправка тестового сообщения...');
    console.log('📦 Формат:', {
      notification: message.notification,
      dataKeys: Object.keys(message.data)
    });

    const response = await messaging.send(message);
    
    console.log('✅ Тест успешен:', response);

    return res.status(200).json({ 
      success: true,
      message: 'Test push sent successfully',
      messageId: response,
      channelId: channelId,
      priority: priority,
      format: 'notification+data'
    });

  } catch (error) {
    console.error('❌ Ошибка теста:', error);
    console.error('Полная ошибка:', {
      code: error.code,
      message: error.message,
      details: error.details
    });
    
    return res.status(500).json({ 
      error: 'Test failed',
      details: error.message,
      code: error.code
    });
  }
};