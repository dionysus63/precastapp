export function getRequiredString(
  formData: FormData,
  field: string,
  label?: string,
): string {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) {
    throw new Error(`${label ?? field} is required.`);
  }
  return value;
}

export function getOptionalString(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

export function getNonNegativeInt(
  formData: FormData,
  field: string,
  label: string,
  defaultValue?: number,
): number {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`${label} is required.`);
  }

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
  if (value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return value;
}

export function getOptionalDate(
  formData: FormData,
  field: string,
  label?: string,
): Date | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label ?? field}.`);
  }

  return date;
}

export function getEnum<T extends string>(
  formData: FormData,
  field: string,
  allowed: readonly T[],
  options?: { label?: string; defaultValue?: T },
): T {
  const raw = String(formData.get(field) ?? options?.defaultValue ?? "").trim();
  if (!raw) {
    throw new Error(`${options?.label ?? field} is required.`);
  }

  if (!allowed.includes(raw as T)) {
    throw new Error(`Invalid ${options?.label ?? field}.`);
  }

  return raw as T;
}
