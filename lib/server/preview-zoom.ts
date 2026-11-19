import { prisma } from "@/lib/prisma";
import {
  pdfZoomFromPercent,
  type PdfZoom,
  type PreviewZoomScreen,
} from "@/lib/preview-zoom";

/**
 * The zoom a user chose to keep for one screen's PDF previews ("Keep zoom"),
 * or "fit" when they never kept one. A preview setting must never keep a
 * screen from opening, so anything that goes wrong reading it is also "fit".
 */
export async function loadKeptPreviewZoom(
  userId: string | null | undefined,
  screen: PreviewZoomScreen,
): Promise<PdfZoom> {
  if (!userId) {
    return 1;
  }
  try {
    const row = await prisma.userPreviewZoom.findUnique({
      where: { userId_screen: { userId, screen } },
      select: { zoomPercent: true },
    });
    return pdfZoomFromPercent(row?.zoomPercent);
  } catch (error) {
    console.error("Could not read the kept preview zoom.", error);
    return 1;
  }
}
