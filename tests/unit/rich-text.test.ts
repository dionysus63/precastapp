import { describe, expect, it } from "vitest";
import { richTextToPlainText } from "@/lib/rich-text";

describe("richTextToPlainText", () => {
  it("decodes entities even when the value has no HTML tags", () => {
    expect(richTextToPlainText(`9'-2&quot; x 8'-6&quot;`)).toBe(
      `9'-2" x 8'-6"`,
    );
  });

  it("decodes named and numeric quote entities", () => {
    expect(richTextToPlainText("A &amp; B &#34;test&#x22; &apos;ok&apos;"))
      .toBe(`A & B "test" 'ok'`);
  });
});
