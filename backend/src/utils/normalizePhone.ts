import { parsePhoneNumber } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

/**
 * Normalize a phone number to E.164 format.
 * Throws if the number cannot be parsed or is invalid.
 *
 * @param phone - Raw phone number string (any format)
 * @param defaultCountry - ISO 3166-1 alpha-2 region code for numbers without country prefix (e.g., 'US')
 */
export function normalizePhone(phone: string, defaultCountry: CountryCode = 'US' as CountryCode): string {
  const pn = parsePhoneNumber(phone, { defaultCountry });
  if (!pn.isValid()) {
    throw new Error(`Invalid phone number: ${phone}`);
  }
  return pn.number; // E.164 format, e.g., +15551234567
}