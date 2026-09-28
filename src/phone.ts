/**
 * Turns "+91 98765-43210", "09876543210" or "9876543210" into "9876543210".
 * Returns '' when it isn't a valid Indian mobile number. Mirrors normalizePhone_ in Code.gs.
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Business names match regardless of case, spacing and punctuation:
 * "ABC Builders Pvt. Ltd." and "abc builders pvt ltd" both become "abcbuilderspvtltd".
 * Mirrors normalizeBusiness_ in Code.gs.
 */
export const normalizeBusiness = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
