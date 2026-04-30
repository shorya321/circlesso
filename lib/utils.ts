import { randomBytes } from "crypto";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Redact an email address for safe logging — keeps domain for correlation,
 * truncates the local-part. "alice@example.com" -> "al***@example.com".
 */
export function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return "[redacted]";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIALS = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
const ALL_CHARS = UPPERCASE + LOWERCASE + DIGITS + SPECIALS;

/**
 * Pick one character from `charset` using rejection sampling so the
 * distribution is exactly uniform — no modulo bias.
 *
 * For a charset of length N, valid bytes are 0..floor(256/N)*N - 1.
 * Bytes >= that ceiling are rejected and resampled. For all charsets used
 * here (26, 10, 29, 91), the rejection rate is well under 30%, so the
 * loop terminates in 1-2 iterations on average.
 */
function pickFromCharset(charset: string): string {
  const max = Math.floor(256 / charset.length) * charset.length;
  while (true) {
    const byte = randomBytes(1)[0];
    if (byte < max) {
      return charset[byte % charset.length];
    }
  }
}

/**
 * Generates a cryptographically random password that meets Auth0's default
 * password policy: uppercase, lowercase, digit, and special character.
 *
 * Uses rejection sampling for unbiased character selection (CSPRNG quality).
 */
export function generateRandomPassword(length: number = 32): string {
  // Guarantee at least one of each required character class
  const required = [
    pickFromCharset(UPPERCASE),
    pickFromCharset(LOWERCASE),
    pickFromCharset(DIGITS),
    pickFromCharset(SPECIALS),
  ];

  // Fill remaining positions from the full character set
  const remaining = Array.from({ length: length - required.length }, () =>
    pickFromCharset(ALL_CHARS)
  );

  // Combine and shuffle using Fisher-Yates with rejection-sampled indices
  const chars = [...required, ...remaining];
  for (let i = chars.length - 1; i > 0; i--) {
    const bound = i + 1;
    const max = Math.floor(256 / bound) * bound;
    let byte: number;
    do {
      byte = randomBytes(1)[0];
    } while (byte >= max);
    const j = byte % bound;
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
