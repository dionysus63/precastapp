import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The preview pane beside a form (components/common/live-pdf-preview.tsx)
 * switches between "beside the inputs" and "opened on request" at one window
 * width. Tailwind needs that width written out in every class, so nothing but
 * this test keeps the copies equal. A pair that disagrees leaves a band of
 * window widths where neither layout applies and the preview lands under the
 * form, off screen: what the office saw at 200% Windows scale.
 */
const source = readFileSync(
  path.join(process.cwd(), "components/common/live-pdf-preview.tsx"),
  "utf8",
);

describe("preview pane breakpoint", () => {
  const declared = Number(
    /PREVIEW_BESIDE_INPUTS_MIN_WIDTH = (\d+);/.exec(source)?.[1],
  );

  it("is declared once as a number of pixels", () => {
    expect(declared).toBeGreaterThan(0);
  });

  it("is the width in every min-[…] and max-[…] class", () => {
    const widths = [...source.matchAll(/\b(?:min|max)-\[(\d+)px\]:/g)].map(
      (match) => Number(match[1]),
    );
    expect(widths.length).toBeGreaterThan(10);
    expect(new Set(widths)).toEqual(new Set([declared]));
  });

  it("keeps the preview beside the form at 200% scale with two clicks of Zoom In", () => {
    // 3840px monitor / 200% / (1.2 zoom) = 1600px of window.
    expect(declared).toBeLessThanOrEqual(1600);
  });
});
