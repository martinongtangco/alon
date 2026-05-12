import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authDevice } from '../../middleware/authDevice';
import { withAudit, AuditAction } from '../../audit';
import { withDeviceAudit } from '../../audit/device';

export const revealsRouter = Router();

revealsRouter.use(authDevice);

// Helper: extract userId from device JWT
const userId = (req: Request): string => {
  return req.deviceId!;
};

// POST /api/reveals — Send a reveal request to a recipient token
revealsRouter.post('/', async (req: Request, res: Response) => {
  const senderId = userId(req);
  const { recipient_token }: { recipient_token: string } = req.body;

  if (!recipient_token) {
    return res.status(400).json({ error: 'recipient_token is required' });
  }

  const client = await pool.connect();

  try {
    // Look up recipient user ID from token
    const userRow = await client.query(
      'SELECT id FROM app.users WHERE internal_token = $1',
      [recipient_token]
    );

    if (userRow.rowCount === 0) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    const recipientId = userRow.rows[0].id;

    // Check if an existing row exists in any direction
    const existing = await client.query(
      `SELECT id, status, initiator_id, recipient_id FROM app.reveals
       WHERE (initiator_id = $1 AND recipient_id = $2)
          OR (initiator_id = $2 AND recipient_id = $1)
       LIMIT 1`,
      [senderId, recipientId]
    );

    if (existing.rowCount > 0) {
      const row = existing.rows[0];
      if (row.status === 'MUTUAL') {
        return res.status(409).json({ error: 'already_mutual' });
      }
      // PENDING: check direction
      // If the existing row is sender -> recipient, it's idempotent (same direction)
      if (row.initiator_id === senderId && row.recipient_id === recipientId) {
        return res.json({ status: 'pending', id: row.id });
      }
      // Reverse direction: recipient is now accepting -> transition to MUTUAL
      const result = await client.query(
        `UPDATE app.reveals
         SET status = 'MUTUAL', mutual_at = NOW()
         WHERE id = $1
         RETURNING id, status, mutual_at, created_at`,
        [row.id]
      );

      // Log MUTUAL audit
      await withDeviceAudit(
        client,
        AuditAction.REVEAL_MATCHED,
        [row.initiator_id, row.recipient_id],
        { by: senderId, type: 'accept' }
      );

      return res.json({
        status: 'mutual' as const,
        id: result.rows[0].id,
        mutual_at: result.rows[0].mutual_at,
        created_at: result.rows[0].created_at,
      });
    }

    // Create PENDING reveal
    const result = await client.query(
      `INSERT INTO app.reveals (initiator_id, recipient_id, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING id, status, created_at`,
      [senderId, recipientId]
    );

    // Log device-initiated audit event
    await withDeviceAudit(
      client,
      AuditAction.REVEAL_REQUEST,
      [senderId, recipientId],
      { by: senderId, type: 'initiate' }
    );

    return res.json({
      status: 'pending' as const,
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('POST /reveals error:', err);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

// GET /api/reveals/matches — List all MUTUAL reveals for the current user
// MUTUAL records are permanent (no expires_at filter)
revealsRouter.get('/matches', async (req: Request, res: Response) => {
  const currentUserId = req.deviceId!;

  const result = await pool.query(
    `SELECT
       r.id,
       r.initiator_id,
       r.recipient_id,
       r.mutual_at,
       u.display_name,
       u.photo_url,
       u.vibes,
       CASE WHEN r.initiator_id = $1 THEN 'self' ELSE 'other' END AS role
     FROM app.reveals r
     JOIN app.users u ON (
       CASE WHEN r.initiator_id = $1 THEN r.recipient_id ELSE r.initiator_id END = u.id
     )
     WHERE r.status = 'MUTUAL'
       AND (r.initiator_id = $1 OR r.recipient_id = $1)
       AND r.removed_by IS NULL
     ORDER BY r.mutual_at DESC`,
    [currentUserId]
  );

  const matches = result.rows.map((row: any) => ({
    id: row.id,
    name: row.display_name,
    photo_url: row.photo_url || null,
    vibes: row.vibes || [],
    mutual_at: row.mutual_at,
    role: row.role,
  }));

  return res.json(matches);
});

// DELETE /api/reveals/:id — Soft-remove a mutual reveal (own side only)
revealsRouter.delete('/:id', async (req: Request, res: Response) => {
  const currentUserId = req.deviceId!;
  const { id } = req.params;

  const client = await pool.connect();

  try {
    // Verify ownership and soft-delete (own side only)
    const result = await client.query(
      `UPDATE app.reveals
       SET removed_by = $1, removed_at = NOW()
       WHERE id = $2
         AND status = 'MUTUAL'
         AND (initiator_id = $3 OR recipient_id = $3)
         AND removed_by IS NULL
       RETURNING id, initiator_id, recipient_id`,
      [currentUserId, id, currentUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const row = result.rows[0];

    // Log device-initiated audit event
    await withDeviceAudit(
      client,
      AuditAction.REVEAL_REMOVED,
      [row.initiator_id, row.recipient_id],
      { by: currentUserId, type: 'remove' }
    );

    return res.json({ removed: true });
  } catch (err) {
    console.error('DELETE /reveals/:id error:', err);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});
