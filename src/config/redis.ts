import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.log('Redis not available - continuing without Redis cache');
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client is ready');
});

// Try to connect, but don't fail if Redis isn't available
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.log('⚠️  Redis not available - app will work without caching');
  }
})();

export default redisClient;