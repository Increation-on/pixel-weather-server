const { getMessaging } = require('../lib/firebase.js');
const addCorsHeaders = require('./_cors.js');

module.exports = async function handler(req, res) {
  // CORS headers
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
      data = {}
    } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    console.log(`📤 Тест: Отправка на ${fcmToken.substring(0, 20)}...`);
    console.log(`🎯 Канал: ${channelId}`);

    const messaging = getMessaging();

    // Data-only сообщение для Notifee
    const message = {
      token: fcmToken,
      
      data: {
        // Основные поля
        title: title,
        body: body,
        channel_id: channelId,
        
        // Метаданные
        type: 'test',
        source: 'server_test',
        timestamp: new Date().toISOString(),
        priority: channelId.includes('high') ? 'high' : 'normal',
        
        // Для Android
        android_channel_id: channelId,
        sound: channelId.includes('low') ? null : 'default',
        
        // Дополнительные данные
        ...data
      },
      
      android: {
        priority: channelId.includes('high') ? 'high' : 'normal',
        ttl: 3600000
      },
      
      apns: {
        headers: {
          "apns-priority": channelId.includes('high') ? "10" : "5"
        },
        payload: {
          aps: {
            sound: channelId.includes('low') ? null : "default",
            badge: 1,
            contentAvailable: 1,
            mutableContent: 1
          }
        }
      }
    };

    console.log('📤 Отправка тестового сообщения...');

    const response = await messaging.send(message);
    
    console.log('✅ Тест успешен:', response);

    return res.status(200).json({ 
      success: true,
      message: 'Test push sent successfully',
      messageId: response,
      channelId: channelId
    });

  } catch (error) {
    console.error('❌ Ошибка теста:', error);
    return res.status(500).json({ 
      error: 'Test failed',
      details: error.message,
      code: error.code
    });
  }
};