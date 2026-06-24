import { Router, Request, Response } from 'express';

export const webhooksRouter = Router();

// POST /api/webhooks/stripe-identity
// ADR 0035: Stripe Identity webhook scaffold (inactive in M2).
// When FEATURE_ID_VERIFICATION is active, this handler processes
// verification completion and updates age_verified on app.users.
webhooksRouter.post('/stripe-identity', async (req: Request, res: Response) => {
  const featureEnabled = process.env.FEATURE_ID_VERIFICATION === 'true';

  if (!featureEnabled) {
    // Scaffold active but third-party verification not enabled
    console.warn('[webhooks/stripe-identity] FEATURE_ID_VERIFICATION not active — ignoring payload');
    return res.json({ ok: true, status: 'ignored' });
  }

  // TODO: M3 — implement Stripe Identity webhook processing:
  // 1. Verify Stripe signature (req.headers['stripe-signature'])
  // 2. Extract verification_session.id and status
  // 3. Map session to deviceId via app.users.stripe_verification_session_id
  // 4. On 'verified': UPDATE app.users SET age_verified = true, age_verified_at = NOW()
  // 5. Return 200 to Stripe

  console.log('[webhooks/stripe-identity] received webhook (scaffold)');
  res.json({ ok: true });
});