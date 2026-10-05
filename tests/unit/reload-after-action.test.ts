import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadWithWindow() {
  const calls: string[] = [];
  vi.stubGlobal("window", {
    location: {
      reload: () => calls.push("reload"),
      assign: (href: string) => calls.push(`assign ${href}`),
    },
    sessionStorage: { setItem: () => undefined },
  });
  const helpers = await import("@/lib/reload-after-action");
  const unsaved = await import("@/lib/unsaved-changes");
  return { calls, helpers, unsaved };
}

// The desktop shell silently cancels a page load that a beforeunload guard
// objects to. After a successful save the editors are still "dirty", so the
// helpers must lift the guard or the screen just sits there.
describe("leaving the page after a successful action", () => {
  it("reloadAfterAction lifts the unsaved-changes guard before reloading", async () => {
    const { calls, helpers, unsaved } = await loadWithWindow();
    expect(unsaved.isUnloadAllowed()).toBe(false);
    helpers.reloadAfterAction();
    expect(unsaved.isUnloadAllowed()).toBe(true);
    expect(calls).toEqual(["reload"]);
  });

  it("navigateAfterAction lifts the guard before navigating", async () => {
    const { calls, helpers, unsaved } = await loadWithWindow();
    helpers.navigateAfterAction("/delivery-tickets/abc");
    expect(unsaved.isUnloadAllowed()).toBe(true);
    expect(calls).toEqual(["assign /delivery-tickets/abc"]);
  });
});
