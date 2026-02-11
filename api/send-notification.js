// api/send-notification.js
import { Expo } from 'expo-server-sdk';

// Инициализируем Expo SDK
const expo = new Expo();

export default async function handler(req, res) {
  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      details: 'Only POST requests are accepted'
    });
  }

  const { fcmToken, title, body, priority = 'high', data = {} } = req.body;

  // Валидация обязательных полей
  if (!fcmToken) {
    return res.status(400).json({ 
      error: 'Missing required field',
      details: 'fcmToken is required'
    });
  }

  if (!title || !body) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'title and body are required'
    });
  }

  // Проверяем, что это валидный Expo Push Token
  if (!Expo.isExpoPushToken(fcmToken)) {
    return res.status(400).json({ 
      error: 'Invalid Expo push token',
      details: 'Token must start with ExponentPushToken[...]',
      receivedToken: fcmToken.substring(0, 30) + '...' // Частично для отладки
    });
  }

  try {
    // Формируем сообщение для Expo Push Service
    const message = {
      to: fcmToken,
      sound: 'default',
      title,
      body,
      priority: priority === 'high' ? 'high' : 'normal',
      data, // Передаем дополнительные данные если есть
      channelId: 'weather-alerts', // Для Android каналов
      _displayInForeground: true, // Показывать когда приложение в фореграунде
    };

    console.log('Sending Expo push notification:', {
      token: fcmToken.substring(0, 30) + '...',
      title,
      body
    });

    // Отправляем через Expo Push Service
    const tickets = await expo.sendPushNotificationsAsync([message]);
    
    // Проверяем первый тикет (мы отправили только одно сообщение)
    const ticket = tickets[0];
    
    if (ticket.status === 'error') {
      console.error('Expo push error:', ticket);
      return res.status(500).json({
        error: 'Expo push service error',
        details: ticket.message,
        code: ticket.details?.error
      });
    }

    // Успешная отправка
    return res.status(200).json({
      success: true,
      ticket,
      message: 'Notification sent successfully via Expo Push Service'
    });

  } catch (error) {
    console.error('Failed to send Expo push:', error);
    
    return res.status(500).json({
      error: 'Failed to send notification',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}