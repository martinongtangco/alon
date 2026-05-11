import { redis } from '../redis';
import { DEFAULTS } from '../config';

// Vibe profile stored per user in Redis
export interface VibeProfile {
  vibes: string[];
  updated_at: string;
}

// Compatibility categories used by the app
export const COMPATIBILITY_CATEGORIES = [
  'music',
  'food',
  'hobbies',
  'values',
  'lifestyle',
  'humor',
  'fashion',
  'culture',
] as const;

export type CompatibilityCategory = typeof COMPATIBILITY_CATEGORIES[number];

/**
 * Compute compatibility score between two vibe profiles.
 * Returns a number in [0, 1].
 *
 * Formula: Jaccard similarity weighted by category overlap.
 *   score = |intersection| / |union|
 *
 * This is simple, symmetric, and monotonic in the number of shared vibes.
 */
export function compatibilityScore(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);

  let intersection = 0;
  for (const v of setA) {
    if (setB.has(v)) intersection++;
  }

  // Union size: |A| + |B| - |intersection|
  const union = setA.size + setB.size - intersection;

  return intersection / union;
}

/**
 * Check if two users meet the compatibility threshold.
 */
export function isCompatible(a: string[], b: string[], threshold?: number): boolean {
  const t = threshold ?? DEFAULTS.COMPATIBILITY_THRESHOLD;
  return compatibilityScore(a, b) >= t;
}

/**
 * Write a user's vibe profile to Redis.
 * Key: proximity:vibes:{token}
 * TTL: 24 hours (matches proximity window)
 */
export async function writeVibes(token: string, vibes: string[]): Promise<void> {
  const key = `proximity:vibes:${token}`;
  const profile: VibeProfile = {
    vibes,
    updated_at: new Date().toISOString(),
  };
  await redis.set(key, JSON.stringify(profile), 'EX', 86400);
}

/**
 * Read a user's vibe profile from Redis.
 */
export async function readVibes(token: string): Promise<VibeProfile | null> {
  const key = `proximity:vibes:${token}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as VibeProfile;
}

/**
 * Batch compute compatibility between a user and a list of peer tokens.
 * Returns sorted results (highest compatibility first).
 */
export async function findCompatiblePeers(
  userToken: string,
  peerTokens: string[],
  threshold?: number,
): Promise<Array<{ token: string; score: number; compatible: boolean }>> {
  const userVibes = await readVibes(userToken);
  if (!userVibes || userVibes.vibes.length === 0) return [];

  const results: Array<{ token: string; score: number; compatible: boolean }> = [];

  for (const peerToken of peerTokens) {
    const peerVibes = await readVibes(peerToken);
    if (!peerVibes || peerVibes.vibes.length === 0) continue;

    const score = compatibilityScore(userVibes.vibes, peerVibes.vibes);
    const compatible = isCompatible(userVibes.vibes, peerVibes.vibes, threshold);
    results.push({ token: peerToken, score, compatible });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}