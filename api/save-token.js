// api/save-token.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Разрешаем CORS для клиента
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;
  
  if (!token?.startsWith('ExponentPushToken')) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  try {
    // Сохраняем в Redis
    await kv.sadd('push_tokens', token);
    
    // Логируем для отладки
    console.log('✅ Token saved:', token);
    console.log('📊 Total tokens:', await kv.scard('push_tokens'));
    
    res.status(200).json({ 
      success: true,
      message: 'Token saved'
    });
  } catch (error) {
    console.error('❌ KV Error:', error);
    res.status(500).json({ error: error.message });
  }
}