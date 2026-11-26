import type { ReactNode } from "react";
import { PreviewZoomProvider } from "@/components/common/pdf-zoom-buttons";
import { loadKeptPreviewZooms } from "@/lib/server/preview-zoom";

/**
 * Gives the previews inside it the zooms a user's account keeps ("Keep
 * zoom"). `DashboardShell` does this for the pages it wraps; a page drawn
 * outside the shell (the print preview pages) wraps its content in this.
 */
export async function KeptPreviewZooms({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  return (
    <PreviewZoomProvider kept={await loadKeptPreviewZooms(userId)}>
      {children}
    </PreviewZoomProvider>
  );
}
