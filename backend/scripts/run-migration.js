require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE app.users
        ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;
    `);
    console.log('✓ phone column added');

    await client.query(`
      ALTER TABLE app.users
        ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('✓ phone_verified column added');

    await client.query(`
      ALTER TABLE app.users
        ADD COLUMN IF NOT EXISTS push_token TEXT;
    `);
    console.log('✓ push_token column added');

    await client.query(`
      CREATE TABLE IF NOT EXISTS app.matches (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_a   UUID NOT NULL REFERENCES app.users(id),
        device_b   UUID NOT NULL REFERENCES app.users(id),
        status     TEXT NOT NULL DEFAULT 'mutual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(device_a, device_b)
      );
    `);
    console.log('✓ app.matches table created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_status ON app.matches(status);
    `);
    console.log('✓ app.matches index created');

    // M1: email/password auth is not used — drop NOT NULL so phone-only users can be inserted
    await client.query(`
      ALTER TABLE app.users
        ALTER COLUMN display_name DROP NOT NULL,
        ALTER COLUMN email DROP NOT NULL,
        ALTER COLUMN password_hash DROP NOT NULL;
    `);
    console.log('✓ display_name/email/password_hash made nullable');

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
