// DEV ONLY — seeds a default Super Admin account and fake app users for local development
// Run: npm run seed
// Credentials: admin@alon.app / password123 (TOTP disabled)
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
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

  // ─── Seed fake app users ───────────────────────────────────────────────
  const vibesPool = ['music', 'coffee', 'tech', 'outdoors', 'art', 'fitness', 'gaming', 'food'];
  const modes = ['Vibe', 'Chill', 'Focus'];
  const plans = ['Free', 'Pro'];
  const firstNames = [
    'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley',
    'Avery', 'Quinn', 'Sage', 'Drew', 'Blake',
    'Cameron', 'Parker', 'Dakota', 'Reese', 'Skyler',
    'Finley', 'Emerson', 'Rowan', 'Hayden', 'Jamie'
  ];

  const appUsers = [];
  // Fixed UUIDs for idempotency — re-running seed won't duplicate rows
  const fixedUserIds = [
    'a1a1a1a1-0000-4000-a000-000000000001',
    'a1a1a1a1-0000-4000-a000-000000000002',
    'a1a1a1a1-0000-4000-a000-000000000003',
    'a1a1a1a1-0000-4000-a000-000000000004',
    'a1a1a1a1-0000-4000-a000-000000000005',
    'a1a1a1a1-0000-4000-a000-000000000006',
    'a1a1a1a1-0000-4000-a000-000000000007',
    'a1a1a1a1-0000-4000-a000-000000000008',
    'a1a1a1a1-0000-4000-a000-000000000009',
    'a1a1a1a1-0000-4000-a000-000000000010',
    'a1a1a1a1-0000-4000-a000-000000000011',
    'a1a1a1a1-0000-4000-a000-000000000012',
    'a1a1a1a1-0000-4000-a000-000000000013',
    'a1a1a1a1-0000-4000-a000-000000000014',
    'a1a1a1a1-0000-4000-a000-000000000015',
    'a1a1a1a1-0000-4000-a000-000000000016',
    'a1a1a1a1-0000-4000-a000-000000000017',
    'a1a1a1a1-0000-4000-a000-000000000018',
    'a1a1a1a1-0000-4000-a000-000000000019',
    'a1a1a1a1-0000-4000-a000-000000000020',
  ];

  for (let i = 0; i < 20; i++) {
    const firstName = firstNames[i];
    const lastInitial = String.fromCharCode(65 + (i % 26));
    const lastActive = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const createdAt = new Date(lastActive.getTime() - (1 + Math.random() * 365) * 24 * 60 * 60 * 1000);

    // Shuffle vibes pool and slice to avoid duplicates
    const shuffledVibes = [...vibesPool].sort(() => Math.random() - 0.5);
    const numVibes = 1 + Math.floor(Math.random() * 3);
    const userVibes = shuffledVibes.slice(0, numVibes);

    appUsers.push({
      id: fixedUserIds[i],
      display_name: `${firstName} ${lastInitial}.`,
      internal_token: uuidv4(),
      current_mode: modes[i % modes.length],
      vibes: userVibes,
      plan: plans[i % 2],
      status: i < 14 ? 'Active' : (i < 17 ? 'Suspended' : 'Banned'),
      platform: i % 2 === 0 ? 'ios' : 'android',
      last_active_at: lastActive,
      created_at: createdAt
    });
  }

  const values = appUsers.map((u, idx) =>
    `($${idx * 10 + 1}, $${idx * 10 + 2}, $${idx * 10 + 3}, $${idx * 10 + 4}, $${idx * 10 + 5}, $${idx * 10 + 6}, $${idx * 10 + 7}, $${idx * 10 + 8}, $${idx * 10 + 9}, $${idx * 10 + 10})`
  ).join(', ');

  const valuesFlat = appUsers.flatMap(u => [
    u.id, u.display_name, u.internal_token, u.current_mode,
    JSON.stringify(u.vibes), u.plan, u.status, u.platform,
    u.last_active_at, u.created_at
  ]);

  const { rowCount: appRowCount } = await pool.query(
    `INSERT INTO app.users (id, display_name, internal_token, current_mode, vibes, plan, status, platform, last_active_at, created_at)
     VALUES ${values}
      ON CONFLICT (id) DO NOTHING`,
    valuesFlat
  );

  console.log(`Seeded ${appRowCount} app users`);

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
