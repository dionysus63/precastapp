"use client";

import { useEffect } from "react";
import {
  isUnloadAllowed,
  registerUnsavedChanges,
} from "@/lib/unsaved-changes";

export function useUnsavedChangesWarning(isDirty: boolean, message?: string) {
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const warningMessage =
      message ??
      "You have unsaved changes. Leave this page and discard them?";

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // The user already chose to reload (new-version banner).
      if (isUnloadAllowed()) {
        return;
      }
      event.preventDefault();
      event.returnValue = warningMessage;
    };

    const release = registerUnsavedChanges();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      release();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, message]);
}
