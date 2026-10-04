"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { takeFlashMessage } from "@/lib/reload-after-action";

/** Shows the message a reloadAfterAction/navigateAfterAction call left. */
function FlashToast() {
  useEffect(() => {
    const flash = takeFlashMessage();
    if (!flash) {
      return;
    }
    // Warnings and errors usually need acting on — keep them up longer.
    const duration =
      flash.type === "warning" || flash.type === "error" ? 15_000 : undefined;
    toast[flash.type](flash.text, { duration });
  }, []);
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmDialogProvider>
      {children}
      <Toaster position="top-right" richColors closeButton />
      <FlashToast />
    </ConfirmDialogProvider>
  );
}
