import { PoolClient } from 'pg';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

export enum AuditAction {
  USER_SUSPEND = 'USER_SUSPEND',
  USER_REINSTATE = 'USER_REINSTATE',
  USER_BAN = 'USER_BAN',
  USER_RATE_LIMIT = 'USER_RATE_LIMIT',
  BUSINESS_APPROVE = 'BUSINESS_APPROVE',
  BUSINESS_REJECT = 'BUSINESS_REJECT',
  BUSINESS_SUSPEND = 'BUSINESS_SUSPEND',
  BUSINESS_REINSTATE = 'BUSINESS_REINSTATE',
  PROMO_PAUSE = 'PROMO_PAUSE',
  PROMO_KILL = 'PROMO_KILL',
  FLAG_DISMISS = 'FLAG_DISMISS',
  FLAG_ESCALATE = 'FLAG_ESCALATE',
  FLAG_RESOLVE = 'FLAG_RESOLVE',
  EVENT_APPROVE = 'EVENT_APPROVE',
  EVENT_REJECT = 'EVENT_REJECT',
  EVENT_FEATURE = 'EVENT_FEATURE',
  CONFIG_UPDATE = 'CONFIG_UPDATE',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_LOGOUT = 'ADMIN_LOGOUT',
}

interface AuditContext {
  adminId: string;
  adminRole: string;
  ipAddress: string;
}

export const withAudit = async (
  client: PoolClient,
  context: AuditContext,
  actionType: AuditAction,
  subjectId?: string | string[],
  beforeState?: any,
  afterState?: any
) => {
  if (!context.adminId || !context.adminRole) {
    throw new Error('Audit log failed: Missing admin context.');
  }

  const query = `
    INSERT INTO audit.entries (
      id, admin_id, admin_role, action_type, subject_id, before_state, after_state, ip_address
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
  `;

  const values = [
    uuidv4(),
    context.adminId,
    context.adminRole,
    actionType,
    Array.isArray(subjectId) ? subjectId[0] : (subjectId || null),
    beforeState ? JSON.stringify(beforeState) : null,
    afterState ? JSON.stringify(afterState) : null,
    context.ipAddress || null,
  ];

  await client.query(query, values);
};

export const extractAuditContext = (req: Request): AuditContext => {
  return {
    adminId: (req as any).user?.id,
    adminRole: (req as any).user?.role,
    ipAddress: req.ip || '',
  };
};
