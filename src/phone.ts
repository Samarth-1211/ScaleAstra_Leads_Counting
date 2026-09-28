/** Strips a leading +91 or 0: "+91 98765-43210" and "09876543210" both become "9876543210". */
function phoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * Turns "+91 98765-43210", "09876543210" or "9876543210" into "9876543210".
 * Returns '' when it isn't a valid Indian mobile number. Mirrors normalizePhone_ in Code.gs.
 */
export function normalizePhone(raw: string): string {
  const digits = phoneDigits(raw);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

/**
 * Like normalizePhone, but also accepts landlines with their STD code ("022 2345 6789").
 * Used for a business's other numbers. Mirrors normalizeAnyPhone_ in Code.gs.
 */
export function normalizeAnyPhone(raw: string): string {
  const digits = phoneDigits(raw);
  return /^[2-9]\d{9}$/.test(digits) ? digits : '';
}

/** "9876543210" becomes "98765 43210"; landlines are shown as they are. */
export const formatPhone = (digits: string) =>
  /^[6-9]/.test(digits) ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

export const isValidEmail =(email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Business names match regardless of case, spacing and punctuation:
 * "ABC Builders Pvt. Ltd." and "abc builders pvt ltd" both become "abcbuilderspvtltd".
 * Mirrors normalizeBusiness_ in Code.gs.
 */
export const normalizeBusiness = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
