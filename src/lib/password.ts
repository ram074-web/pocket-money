import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

/**
 * Hashes a password with scrypt (memory-hard, from Node's stdlib — no
 * dependency needed). Output format: "scrypt:<saltHex>:<keyHex>".
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `${PREFIX}:${salt.toString("hex")}:${key.toString("hex")}`;
}

/**
 * Verifies a password against a stored hash in constant time, so a caller
 * can't learn the hash by timing the comparison.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;

  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scrypt(password, salt, KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

// Minimum viable policy for a system holding financial records. Kept
// deliberately simple and explicit rather than pulling in a validator.
export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain both letters and numbers.";
  }
  return null;
}
