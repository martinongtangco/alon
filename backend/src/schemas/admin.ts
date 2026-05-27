import { z } from 'zod';

export const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});

export const AdminTotpSchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export const CreateAdminSchema = z.object({
  email: z.string().email(),
  role: z.enum(['SUPER_ADMIN', 'OPS', 'FINANCE']),
});

export const PlatformConfigUpdateSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]),
  confirmation: z.literal(true),
});

export const UserActionSchema = z.object({
  reason: z.string().max(500).optional(),
  confirmation: z.literal(true),
});
