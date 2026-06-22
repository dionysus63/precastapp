import { timingSafeEqual } from "crypto";

export function isSettingsResetConfigured(): boolean {
  return Boolean(process.env.SETTINGS_RESET_PASSWORD?.trim());
}

export function verifySettingsResetPassword(input: string): boolean {
  const expected = process.env.SETTINGS_RESET_PASSWORD?.trim();
  if (!expected || !input.trim()) {
    return false;
  }

  const provided = Buffer.from(input);
  const secret = Buffer.from(expected);
  if (provided.length !== secret.length) {
    return false;
  }

  return timingSafeEqual(provided, secret);
}
