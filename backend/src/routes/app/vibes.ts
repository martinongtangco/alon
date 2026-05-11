import { Router, Request, Response } from 'express';
import { readVibes } from '../../services/proximity';

export const vibesRouter = Router();

// GET /api/users/:token/vibes
// Returns vibe profile for a given proximity token.
// Unauthenticated, token-scoped — returns only vibes, not identity.
// Compatibility scoring is computed client-side per ADR 0024.
vibesRouter.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token || token.trim() === '') {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    const profile = await readVibes(token);

    if (!profile || profile.vibes.length === 0) {
      res.status(404).json({ error: 'vibes not found for token' });
      return;
    }

    res.json({ vibes: profile.vibes });
  } catch (err) {
    // Redis unavailable — degrade gracefully
    res.json({ vibes: [] });
  }
});
