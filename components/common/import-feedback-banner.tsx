type ImportFeedbackBannerProps = {
  imported?: number;
  updated?: number;
  noun?: string;
};

export function ImportFeedbackBanner({
  imported = 0,
  updated = 0,
  noun = "record",
}: ImportFeedbackBannerProps) {
  if (imported <= 0 && updated <= 0) {
    return null;
  }

  const parts: string[] = [];
  if (imported > 0) {
    parts.push(
      `${imported} ${noun}${imported === 1 ? "" : "s"} imported`,
    );
  }
  if (updated > 0) {
    parts.push(
      `${updated} ${noun}${updated === 1 ? "" : "s"} updated`,
    );
  }

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      Bulk import complete: {parts.join(", ")}.
    </div>
  );
}
