"use client";

import { useEffect } from "react";

export function useUnsavedChangesWarning(isDirty: boolean, message?: string) {
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const warningMessage =
      message ??
      "You have unsaved changes. Leave this page and discard them?";

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = warningMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, message]);
}
