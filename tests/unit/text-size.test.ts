import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEXT_SIZE,
  TEXT_SIZE_OPTIONS,
  TEXT_SIZE_SCALE,
  TEXT_SIZE_VALUES,
  isTextSize,
  resolveTextSize,
} from "@/lib/text-size";

const repoRoot = join(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "generated" ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("text size setting", () => {
  it("accepts only the known sizes and falls back to Normal", () => {
    expect(isTextSize("LARGE")).toBe(true);
    expect(isTextSize("HUGE")).toBe(false);
    expect(isTextSize(undefined)).toBe(false);
    expect(resolveTextSize("EXTRA_LARGE")).toBe("EXTRA_LARGE");
    expect(resolveTextSize(null)).toBe(DEFAULT_TEXT_SIZE);
    expect(resolveTextSize("HUGE")).toBe("NORMAL");
  });

  it("offers every size once, Normal first and unscaled", () => {
    expect(TEXT_SIZE_OPTIONS.map((option) => option.value)).toEqual([
      ...TEXT_SIZE_VALUES,
    ]);
    expect(TEXT_SIZE_SCALE.NORMAL).toBe(1);
    expect(TEXT_SIZE_SCALE.LARGE).toBeGreaterThan(1);
    expect(TEXT_SIZE_SCALE.EXTRA_LARGE).toBeGreaterThan(TEXT_SIZE_SCALE.LARGE);
  });

  it("uses the same scale in the stylesheet as in the code", () => {
    const css = readFileSync(join(repoRoot, "app", "globals.css"), "utf8");
    for (const value of TEXT_SIZE_VALUES) {
      const rule =
        value === "NORMAL"
          ? /:root\s*\{\s*--text-scale:\s*([\d.]+);/
          : new RegExp(
              `:root\\[data-text-size="${value}"\\]\\s*\\{\\s*--text-scale:\\s*([\\d.]+);`,
            );
      const match = css.match(rule);
      expect(match, `--text-scale rule for ${value}`).not.toBeNull();
      expect(Number(match![1])).toBe(TEXT_SIZE_SCALE[value]);
    }
  });

  // A pixel size such as text-[11px] ignores the user's Text Size. Use the
  // named sizes from app/globals.css instead (text-3xs = 10px, text-2xs =
  // 11px, text-xsm = 13px, ...).
  it("has no hard-coded pixel text sizes in the app", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(join(repoRoot, dir)))
      .filter((file) => /text-\[[\d.]+px\]/.test(readFileSync(file, "utf8")))
      .map((file) => relative(repoRoot, file));
    expect(offenders).toEqual([]);
  });
});
