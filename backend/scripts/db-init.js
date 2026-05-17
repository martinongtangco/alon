// Run scripts/db-setup.sql followed by the migrations.
// Usage: DATABASE_URL=<railway public url> node scripts/db-init.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  const setupSql = fs.readFileSync(path.join(__dirname, 'db-setup.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('Running db-setup.sql...');
    await client.query(setupSql);
    console.log('✓ schema created');
    console.log('\nDone. Now run: node scripts/run-migration.js (with the same DATABASE_URL)');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
