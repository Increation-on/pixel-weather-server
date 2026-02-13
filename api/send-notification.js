// api/send-notification.js
import { Expo } from 'expo-server-sdk';
import { kv } from '@vercel/kv';

const expo = new Expo();

export default async function handler(req, res) {
  // Разрешаем CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Получаем ВСЕ токены из Redis
    const tokens = await kv.smembers('push_tokens');
    
    if (!tokens || tokens.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No push tokens found' 
      });
    }

    // 2. Фильтруем только валидные Expo-токены
    const validTokens = tokens.filter(token => 
      Expo.isExpoPushToken(token)
    );

    // 3. Создаём сообщения для ВСЕХ пользователей
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title: req.body.title || 'Pixel Weather',
      body: req.body.body || 'Проверьте погоду!',
      data: req.body.data || {},
    }));

    // 4. Отправляем через Expo
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    // 5. Возвращаем статистику
    res.status(200).json({
      success: true,
      recipients: validTokens.length,
      tickets: tickets,
      message: 'Notifications sent to all users'
    });

  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ error: error.message });
  }
}