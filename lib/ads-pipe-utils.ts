export type AdsPipeJointType = "WT" | "ST";

export const adsPipeJointTypeLabels: Record<AdsPipeJointType, string> = {
  WT: "Watertight (WT)",
  ST: "Soiltight (ST)",
};

export const adsPipeJointTypeFormOptions: Array<{
  value: AdsPipeJointType;
  label: string;
}> = [
  { value: "WT", label: adsPipeJointTypeLabels.WT },
  { value: "ST", label: adsPipeJointTypeLabels.ST },
];

export function formatAdsPipeJointTypeLabel(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "WT" || normalized === "ST") {
    return adsPipeJointTypeLabels[normalized];
  }
  return value;
}

export function parseAdsPipeJointType(raw: string): AdsPipeJointType | null {
  const normalized = raw.trim().toUpperCase();
  if (normalized === "WT" || normalized === "WATERTIGHT") {
    return "WT";
  }
  if (normalized === "ST" || normalized === "SOILTIGHT") {
    return "ST";
  }
  return null;
}

export function normalizeAdsPipeJointType(
  value: string | null | undefined,
): AdsPipeJointType | null {
  if (!value) {
    return null;
  }
  return parseAdsPipeJointType(value);
}
