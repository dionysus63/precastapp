import { describe, expect, it } from "vitest";
import { isActionError, unwrapAction } from "@/lib/action-result";

describe("unwrapAction", () => {
  it("rethrows a returned { error } locally with its message", async () => {
    await expect(
      unwrapAction(Promise.resolve({ error: "Ticket is already delivered." })),
    ).rejects.toThrow("Ticket is already delivered.");
  });

  it("passes successful results through", async () => {
    await expect(unwrapAction(Promise.resolve({ success: true }))).resolves.toEqual({
      success: true,
    });
    await expect(unwrapAction(Promise.resolve(undefined))).resolves.toBeUndefined();
  });

  it("treats an empty or absent error field as success", () => {
    expect(isActionError({ error: undefined, success: true })).toBe(false);
    expect(isActionError({ error: "" })).toBe(false);
    expect(isActionError({ error: "Nope" })).toBe(true);
  });
});
