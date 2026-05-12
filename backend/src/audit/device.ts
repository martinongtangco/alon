import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { AuditAction } from '.';

/**
 * Log an audit event for device-initiated (user) actions.
 * Uses 'user' as admin_role and stores the user ID in a 'user_id' column.
 */
export const withDeviceAudit = async (
  client: PoolClient,
  actionType: AuditAction,
  subjectId?: string | string[],
  extra?: Record<string, unknown>
): Promise<void> => {
  const beforeState = extra ? JSON.stringify(extra) : null;

  const query = `
    INSERT INTO audit.entries (
      id, admin_id, admin_role, action_type, subject_id, before_state, after_state, ip_address
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
  `;

  const values = [
    uuidv4(),
    // Use admin_id as the user ID for device-initiated events
    (subjectId && Array.isArray(subjectId) ? subjectId[0] : subjectId) || null,
    'user',
    actionType,
    Array.isArray(subjectId) ? subjectId[0] : (subjectId || null),
    beforeState,
    null,
    null,
  ];

  await client.query(query, values);
};