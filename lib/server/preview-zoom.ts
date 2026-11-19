import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  isPreviewZoomScreen,
  pdfZoomFromPercent,
  type KeptPreviewZooms,
} from "@/lib/preview-zoom";

/**
 * The zoom a user chose to keep for each screen's PDF previews ("Keep
 * zoom"); a screen they never kept one for is left out and opens fitted.
 * Read once per request. A preview setting must never keep a screen from
 * opening, so anything that goes wrong reading it means "all fitted".
 */
export const loadKeptPreviewZooms = cache(
  async (userId: string | null | undefined): Promise<KeptPreviewZooms> => {
    if (!userId) {
      return {};
    }
    try {
      const rows = await prisma.userPreviewZoom.findMany({
        where: { userId },
        select: { screen: true, zoomPercent: true },
      });
      const kept: KeptPreviewZooms = {};
      for (const row of rows) {
        const zoom = pdfZoomFromPercent(row.zoomPercent);
        if (isPreviewZoomScreen(row.screen) && zoom !== 1) {
          kept[row.screen] = zoom;
        }
      }
      return kept;
    } catch (error) {
      console.error("Could not read the kept preview zooms.", error);
      return {};
    }
  },
);
