import { afterEach, describe, expect, it, vi } from "vitest";
import { versionCheckStep } from "@/lib/app-version";
import {
  STALE_DEPLOYMENT_EVENT,
  STALE_DEPLOYMENT_MESSAGE,
  describeActionFailure,
  isStaleDeploymentError,
  unwrapAction,
} from "@/lib/action-result";
import {
  allowUnload,
  hasUnsavedChanges,
  isUnloadAllowed,
  registerUnsavedChanges,
} from "@/lib/unsaved-changes";

/** What Next throws when the server no longer has the page's action. */
function unrecognizedActionError() {
  const error = new Error(
    'Server Action "004fdaa3fdefbbee4297f31241cb56f4fc700d016e" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action',
  );
  error.name = "UnrecognizedActionError";
  return error;
}

describe("versionCheckStep", () => {
  it("does nothing until there is a different build to compare", () => {
    expect(versionCheckStep(null, "abc", false)).toBe("none");
    expect(versionCheckStep("abc", null, false)).toBe("none");
    expect(versionCheckStep("abc", "abc", true)).toBe("none");
  });

  it("never fires against the dev server", () => {
    expect(versionCheckStep("development", "abc", false)).toBe("none");
    expect(versionCheckStep("abc", "development", false)).toBe("none");
  });

  it("reloads quietly when nothing is unsaved, otherwise warns", () => {
    expect(versionCheckStep("old-build", "new-build", false)).toBe("reload");
    expect(versionCheckStep("old-build", "new-build", true)).toBe("warn");
  });
});

describe("stale deployment errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognises Next's unrecognized-action error, not ordinary failures", () => {
    expect(isStaleDeploymentError(unrecognizedActionError())).toBe(true);
    expect(isStaleDeploymentError(new Error("Ticket is already delivered."))).toBe(false);
    expect(isStaleDeploymentError("Server Action x was not found on the server")).toBe(false);
  });

  it("turns it into a readable message and tells the page", async () => {
    const events: string[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (event: Event) => {
        events.push(event.type);
        return true;
      },
    });

    expect(describeActionFailure(unrecognizedActionError(), "fallback")).toBe(
      STALE_DEPLOYMENT_MESSAGE,
    );
    await expect(
      unwrapAction(Promise.reject(unrecognizedActionError())),
    ).rejects.toThrow(STALE_DEPLOYMENT_MESSAGE);
    expect(events).toEqual([STALE_DEPLOYMENT_EVENT, STALE_DEPLOYMENT_EVENT]);
  });

  it("leaves other errors' messages alone", async () => {
    expect(describeActionFailure(new Error("Nope."), "fallback")).toBe("Nope.");
    expect(describeActionFailure("weird", "fallback")).toBe("fallback");
    await expect(unwrapAction(Promise.reject(new Error("Nope.")))).rejects.toThrow(
      "Nope.",
    );
  });
});

describe("unsaved-changes registry", () => {
  it("tracks screens with unsaved edits and releases each once", () => {
    expect(hasUnsavedChanges()).toBe(false);
    const releaseA = registerUnsavedChanges();
    const releaseB = registerUnsavedChanges();
    expect(hasUnsavedChanges()).toBe(true);
    releaseA();
    releaseA();
    expect(hasUnsavedChanges()).toBe(true);
    releaseB();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it("lets an explicit reload through the leave-page guard", () => {
    expect(isUnloadAllowed()).toBe(false);
    allowUnload();
    expect(isUnloadAllowed()).toBe(true);
  });
});
