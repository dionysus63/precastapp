import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const SCRYPT_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return null;
}

export async function hashPassword(plain: string): Promise<string> {
  const strengthError = validatePasswordStrength(plain);
  if (strengthError) {
    throw new Error(strengthError);
  }

  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(plain, salt, SCRYPT_KEY_LENGTH)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) {
    return false;
  }

  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  const derivedKey = (await scryptAsync(plain, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(hash, "hex");

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
}
