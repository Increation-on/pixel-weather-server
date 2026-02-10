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
      data = {},
      priority = 'default' // Добавляем параметр приоритета
    } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    console.log(`📤 Тест: Отправка на ${fcmToken.substring(0, 20)}...`);
    console.log(`🎯 Канал: ${channelId}, Приоритет: ${priority}`);

    const messaging = getMessaging();

    // Data-only сообщение для Notifee
    const message = {
      token: fcmToken,
      
      data: {
        // Основные поля - ВСЕ значения должны быть строками!
        title: String(title),
        body: String(body),
        channel_id: String(channelId),
        
        // Метаданные
        type: 'test',
        source: 'server_test',
        timestamp: new Date().toISOString(),
        priority: String(priority),
        
        // Для Android - только строки
        android_channel_id: String(channelId),
        
        // Звук только если не low приоритет
        ...(channelId !== 'pixel_weather_low' ? { sound: 'default' } : {}),
        
        // Дополнительные данные - конвертируем все в строки
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key, 
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          ])
        )
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
            // Для iOS sound не может быть null, только строка или отсутствует
            ...(channelId !== 'pixel_weather_low' ? { sound: "default" } : {}),
            badge: 1,
            contentAvailable: 1,
            mutableContent: 1
          }
        }
      }
    };

    console.log('📤 Отправка тестового сообщения...');
    console.log('📦 Данные:', JSON.stringify(message.data, null, 2));

    const response = await messaging.send(message);
    
    console.log('✅ Тест успешен:', response);

    return res.status(200).json({ 
      success: true,
      message: 'Test push sent successfully',
      messageId: response,
      channelId: channelId,
      priority: priority
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