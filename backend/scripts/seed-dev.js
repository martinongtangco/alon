// DEV ONLY — seeds a default Super Admin account for local development
// Run: npm run seed
// Credentials: admin@alon.app / password123 (TOTP disabled)
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/alon',
});

async function seed() {
  const hash = await bcrypt.hash('password123', 12);

  const { rowCount } = await pool.query(
    `INSERT INTO admin.users (email, password_hash, role, status, totp_enabled)
     VALUES ($1, $2, 'SUPER_ADMIN', 'Active', false)
     ON CONFLICT (email) DO NOTHING`,
    ['admin@alon.app', hash]
  );

  if (rowCount && rowCount > 0) {
    console.log('Created dev admin: admin@alon.app / password123 (TOTP off)');
  } else {
    console.log('admin@alon.app already exists — skipped');
  }

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
