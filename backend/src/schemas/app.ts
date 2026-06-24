import { z } from 'zod';

export const RequestOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164 format'),
});

// deviceId is optional here — passed when a new device is linking to a phone during OTP verify
export const VerifyOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  code: z.string().length(6).regex(/^\d{6}$/),
  deviceId: z.string().uuid().optional(),
});

export const RegisterSchema = z.object({
  deviceId: z.string().uuid(),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  vibes: z.array(z.string().max(50)).max(10).optional(),
  mode: z.enum(['Networking', 'Chill', 'Dating', 'Explorer']).optional(),
});

// tokens is optional because the GET /api/nearby route also accepts tokens via query params
export const NearbySchema = z.object({
  tokens: z.array(z.string().uuid()).max(50).optional(),
});

export const BuzzSchema = z.object({
  targetToken: z.string().uuid().optional(),
});

export const RevealSchema = z.object({
  token: z.string().uuid(),
});

export const GhostSchema = z.object({
  active: z.boolean(),
});

export const PushTokenSchema = z.object({
  token: z.string().regex(/^ExponentPushToken\[.+\]$|^[a-zA-Z0-9_-]{20,}$/, 'Invalid push token format'),
});

// ADR 0035: Age Verification — DOB self-declaration schema
export const VerifyAgeSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
});
