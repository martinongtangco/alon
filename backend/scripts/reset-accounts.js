require('dotenv').config();
const { Pool } = require('pg');
const Redis = require('ioredis');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

async function run() {
  const client = await pool.connect();
  try {
    // Order matters: clear child tables before app.users (FK constraints)
    await client.query('DELETE FROM app.matches');
    console.log('✓ app.matches cleared');

    await client.query('DELETE FROM app.buzz_events');
    console.log('✓ app.buzz_events cleared');

    await client.query('DELETE FROM app.reveal_events');
    console.log('✓ app.reveal_events cleared');

    await client.query('DELETE FROM app.users');
    console.log('✓ app.users cleared');

    // Clear Redis proximity tokens and reveal intents
    let cursor = '0';
    let cleared = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'token:*', 'COUNT', 100);
      cursor = next;
      if (keys.length) {
        await redis.del(...keys);
        cleared += keys.length;
      }
    } while (cursor !== '0');
    console.log(`✓ ${cleared} Redis token:* keys cleared`);

    cursor = '0';
    cleared = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'reveal:*', 'COUNT', 100);
      cursor = next;
      if (keys.length) {
        await redis.del(...keys);
        cleared += keys.length;
      }
    } while (cursor !== '0');
    console.log(`✓ ${cleared} Redis reveal:* keys cleared`);

    console.log('\nReset complete. Reinstall or clear app data on the device to wipe AsyncStorage.');
  } catch (err) {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    redis.disconnect();
  }
}

run();
