import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Default pool for the application
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/alon',
});

// Dedicated pool for audit logs using the insert-only role
export const auditPool = new Pool({
  connectionString: process.env.AUDIT_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/alon',
});

// It's recommended to have the auditPool connect as 'audit_writer' role
// For development, we fallback to the default connection.
