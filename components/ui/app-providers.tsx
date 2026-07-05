"use client";

import { Toaster } from "sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmDialogProvider>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </ConfirmDialogProvider>
  );
}
