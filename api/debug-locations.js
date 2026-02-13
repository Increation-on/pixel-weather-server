import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const locations = await kv.keys('location:*');
  const users = await kv.keys('user:*');
  
  res.json({
    locations: locations.length,
    users: users.length,
    sampleLocations: locations.slice(0, 5)
  });
}