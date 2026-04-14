import { randomBytes } from "crypto";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIALS = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
const ALL_CHARS = UPPERCASE + LOWERCASE + DIGITS + SPECIALS;

/**
 * Generates a cryptographically random password that meets Auth0's default
 * password policy: uppercase, lowercase, digit, and special character.
 */
export function generateRandomPassword(length: number = 32): string {
  // Guarantee at least one of each required character class
  const required = [
    UPPERCASE[randomBytes(1)[0] % UPPERCASE.length],
    LOWERCASE[randomBytes(1)[0] % LOWERCASE.length],
    DIGITS[randomBytes(1)[0] % DIGITS.length],
    SPECIALS[randomBytes(1)[0] % SPECIALS.length],
  ];

  // Fill remaining positions from the full character set
  const remaining = Array.from(randomBytes(length - required.length), (byte) =>
    ALL_CHARS[byte % ALL_CHARS.length]
  );

  // Combine and shuffle using Fisher-Yates with random bytes
  const chars = [...required, ...remaining];
  const shuffleBytes = randomBytes(chars.length);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
