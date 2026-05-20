import { Router, Request, Response } from 'express';
import { authDevice } from '../../middleware/authDevice';
import { redis } from '../../redis';
import { pool } from '../../db';
import { validate } from '../../middleware/validate';
import { NearbySchema } from '../../schemas/app';

export const nearbyRouter = Router();

nearbyRouter.use(authDevice);

/**
 * Check if a device is in Ghost Mode (ADR 0036).
 * Returns true if the ghost:{deviceId} key exists in Redis.
 */
async function isGhost(deviceId: string): Promise<boolean> {
  const result = await redis.get(`ghost:${deviceId}`);
  return result === '1';
}

// GET /api/nearby
// Vibe Matching Engine (ADR 0028): computes Jaccard similarity between the
// authenticated device's vibes and nearby peers resolved from BLE scan tokens.
//
// Request body: { tokens: string[] }   // proximity tokens from current BLE scan
// Response: Array<{
//   token: string,
//   compatibility: number,             // Jaccard score 0–1
//   distanceBand: 'very-near' | 'near' | 'far'
// }>
nearbyRouter.get('/', validate(NearbySchema), async (req: Request, res: Response) => {
  const featureFlag = process.env.FEATURE_VIBE_MATCHING;
  const enabled = featureFlag === 'true' || featureFlag === '1';

  // Token array capped at 50 by NearbySchema (ADR 0039/0044).
  // BLE scan in a realistic environment produces at most ~20-30 visible tokens.
  // Query-param path is also capped to prevent Redis pipeline amplification.
  const tokens: string[] = (req.body?.tokens as string[]) ?? ((req.query.tokens as string[])?.slice(0, 50) ?? []);

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return res.json([]);
  }

  // ADR 0036: if requester is ghosted, return empty array
  const deviceId = req.deviceId!;
  if (await isGhost(deviceId)) {
    return res.json([]);
  }

  // --- Feature flag off: return stub ---
  if (!enabled) {
    const stub = tokens.map((token) => ({
      token,
      compatibility: 0.5,
      distanceBand: 'far' as const,
    }));
    return res.json(stub);
  }

  // --- Feature flag on: compute real scores ---

  // 1. Resolve tokens via Redis → deviceId
  const deviceIds: string[] = [];
  const tokenOrder: Map<string, number> = new Map();
  let idx = 0;
  for (const token of tokens) {
    const deviceId = await redis.get(`token:${token}`);
    if (deviceId) {
      deviceIds.push(deviceId);
      tokenOrder.set(token, idx);
    }
    idx++;
  }

  // 2. Fetch vibes for all resolved device IDs in a single query
  const vibeMap = new Map<string, string[]>();
  if (deviceIds.length > 0) {
    try {
      const result = await pool.query(
        'SELECT id, vibes FROM "app.users" WHERE id = ANY($1)',
        [deviceIds]
      );
      for (const row of result.rows) {
        vibeMap.set(row.id, (row.vibes as string[]) ?? []);
      }
    } catch {
      // Postgres failure: fall back to 0.5 for all peers (safe default)
      const fallback = tokens.map((token) => ({
        token,
        compatibility: 0.5,
        distanceBand: 'far' as const,
      }));
      return res.json(fallback);
    }
  }

  // 3. Get the requesting device's vibes (deviceId already resolved above)
  const requesterVibes = vibeMap.get(deviceId) ?? [];

  // 4. Compute Jaccard similarity for each peer
  const jaccard = (a: string[], b: string[]): number => {
    if (a.length === 0 && b.length === 0) return 0;
    const union = new Set([...a, ...b]).size;
    if (union === 0) return 0;
    const intersection = a.filter((v) => b.includes(v)).length;
    return intersection / union;
  };

  const distanceBand = (token: string): 'very-near' | 'near' | 'far' => {
    // distanceBand is derived from RSSI signal strength (computed by the app
    // and stored in the token metadata). For now, default to 'far' since the
    // token→deviceId resolution does not include RSSI data. The app merges
    // its own proximity data with the compatibility score.
    return 'far';
  };

  const results = tokens.map((token) => ({
    token,
    compatibility: vibeMap.size > 0
      ? jaccard(requesterVibes, vibeMap.get(deviceIds[tokenOrder.get(token) ?? -1] ?? '') ?? [])
      : 0,
    distanceBand: distanceBand(token),
  }));

  return res.json(results);
});
