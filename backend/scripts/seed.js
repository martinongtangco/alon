const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  try {
    console.log('Running database schema setup...');
    const sql = fs.readFileSync(path.join(__dirname, 'db-setup.sql'), 'utf8');
    await pool.query(sql);

    console.log('Creating test admin user...');
    const hash = await bcrypt.hash('password123', 12);
    
    await pool.query(`
      INSERT INTO admin.users (email, password_hash, role, totp_enabled, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@alon.app', hash, 'SUPER_ADMIN', false, 'Active']);

    console.log('✅ Database seeded successfully!');
    console.log('👉 Test Login: admin@alon.app / password123');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    pool.end();
  }
}

seed();
