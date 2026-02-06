import { getMessaging } from '../../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ 
        error: 'Missing fcmToken' 
      });
    }

    const messaging = getMessaging();

    const message = {
      token: fcmToken,
      notification: {
        title: '🌤️ Pixel Weather Test',
        body: 'Push notifications are working!',
      },
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
    };

    const response = await messaging.send(message);
    
    console.log('Test push sent:', response);

    return res.status(200).json({ 
      success: true,
      message: 'Test push sent successfully',
      response: response
    });

  } catch (error) {
    console.error('Push sending error:', error);
    return res.status(500).json({ 
      error: 'Failed to send push',
      details: error.message 
    });
  }
}