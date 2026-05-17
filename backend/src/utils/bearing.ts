/**
 * ADR 0034: Deterministic bearing from UUID
 *
 * Derives a fixed angular position (0–360°) from any UUID string.
 * Uses the first 8 hex characters as a 32-bit unsigned integer,
 * then maps it to [0, 360) degrees.
 *
 * This is used to position promos/events on the radar UI so each
 * promo/event always appears at the same angle regardless of which
 * user is viewing it.
 */

export function uuidToBearingDeg(uuid: string): number {
  const hex = uuid.replace(/-/g, '').substring(0, 8);
  const int32 = parseInt(hex, 16) >>> 0; // unsigned 32-bit
  return (int32 / 0xffffffff) * 360;
}