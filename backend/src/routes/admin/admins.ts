import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../../db';
import { authAdmin } from '../../middleware/authAdmin';
import { requireRole, AdminRole } from '../../middleware/rbac';
import { withAudit, AuditAction, extractAuditContext } from '../../audit';

export const adminsRouter = Router();

// GET /api/v1/admin/admins
adminsRouter.get('/', authAdmin, requireRole([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, email, role, status, totp_enabled, last_login_at, created_at
       FROM admin.users
       ORDER BY created_at ASC`
    );
    res.json({ data: result.rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/admins
adminsRouter.post('/', authAdmin, requireRole([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  const { email, role } = req.body;

  if (!email || !role) return res.status(400).json({ error: 'email and role are required' });
  if (!Object.values(AdminRole).includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + '!';
  const hash = await bcrypt.hash(tempPassword, 12);
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO admin.users (email, password_hash, role, status, totp_enabled)
       VALUES ($1, $2, $3, 'Active', false)
       RETURNING id, email, role, status, created_at`,
      [email, hash, role]
    );

    const newAdmin = result.rows[0];
    await withAudit(client, auditContext, AuditAction.ADMIN_CREATE, newAdmin.id, null, { email, role });

    await client.query('COMMIT');
    res.status(201).json({ data: newAdmin, tempPassword });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'An admin with that email already exists' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/admins/:id/deactivate
adminsRouter.post('/:id/deactivate', authAdmin, requireRole([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  if (id === auditContext.adminId) return res.status(400).json({ error: 'Cannot deactivate your own account' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT status FROM admin.users WHERE id = $1', [id]);
    if (current.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Admin not found' }); }
    if (current.rows[0].status === 'Inactive') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Admin is already inactive' }); }

    await client.query('UPDATE admin.users SET status = $1 WHERE id = $2', ['Inactive', id]);
    await withAudit(client, auditContext, AuditAction.ADMIN_DEACTIVATE, id, { status: 'Active' }, { status: 'Inactive' });

    await client.query('COMMIT');
    res.json({ success: true });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/admin/admins/:id/activate
adminsRouter.post('/:id/activate', authAdmin, requireRole([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const auditContext = extractAuditContext(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT status FROM admin.users WHERE id = $1', [id]);
    if (current.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Admin not found' }); }
    if (current.rows[0].status === 'Active') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Admin is already active' }); }

    await client.query('UPDATE admin.users SET status = $1 WHERE id = $2', ['Active', id]);
    await withAudit(client, auditContext, AuditAction.ADMIN_ACTIVATE, id, { status: 'Inactive' }, { status: 'Active' });

    await client.query('COMMIT');
    res.json({ success: true });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
