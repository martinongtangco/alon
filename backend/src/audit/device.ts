import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db';
import { AuditAction } from './index';

export async function withDeviceAudit(
  deviceId: string,
  action: AuditAction,
  payload?: { before?: unknown; after?: unknown },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit.entries
         (id, admin_id, admin_role, action_type, subject_id, before_state, after_state, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuidv4(),
        deviceId,
        'user',
        action,
        deviceId,
        payload?.before != null ? JSON.stringify(payload.before) : null,
        payload?.after != null ? JSON.stringify(payload.after) : null,
        null,
      ],
    );
  } catch (err) {
    // Audit failures must not interrupt the primary operation
    console.error('[audit] device audit failed:', err);
  }
}
