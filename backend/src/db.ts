import { Pool } from 'pg';

// Default pool for the application
// dotenv.config() is called once in index.ts — do not duplicate here
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Dedicated pool for audit logs using the insert-only role
export const auditPool = new Pool({
  connectionString: process.env.AUDIT_DATABASE_URL || process.env.DATABASE_URL,
});

// It's recommended to have the auditPool connect as 'audit_writer' role
// For development, ensure DATABASE_URL is set via .env loaded by index.ts.
