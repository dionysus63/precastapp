"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { savePreviewZoom } from "@/app/settings/users/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { describeActionFailure, isActionError } from "@/lib/action-result";
import {
  PDF_ZOOM_STEPS,
  PREVIEW_ZOOM_SCREENS,
  pdfZoomIndex,
  pdfZoomLabel,
  type PdfZoom,
  type PreviewZoomScreen,
} from "@/lib/preview-zoom";

const defaultButtonClassName =
  "rounded btn-plain px-2 py-0.5 text-2xs font-semibold";

/**
 * The − / Fit / + buttons of a PDF preview. "Fit" (or the percent, once
 * zoomed) goes back to the page fitted to its pane.
 */
export function PdfZoomButtons({
  zoomIndex,
  onZoomIndex,
  buttonClassName = defaultButtonClassName,
}: {
  /** Index into PDF_ZOOM_STEPS; 0 is the page fitted to the pane. */
  zoomIndex: number;
  onZoomIndex: (index: number) => void;
  /** Look of each button, to match the buttons the screen puts beside them. */
  buttonClassName?: string;
}) {
  const last = PDF_ZOOM_STEPS.length - 1;
  const zoom = PDF_ZOOM_STEPS[zoomIndex] ?? 1;
  return (
    <div className="flex items-center gap-1" data-live-pdf-zoom={zoom}>
      <button
        type="button"
        onClick={() => onZoomIndex(Math.max(zoomIndex - 1, 0))}
        disabled={zoomIndex === 0}
        title="Zoom out"
        aria-label="Zoom out"
        className={`${buttonClassName} disabled:opacity-40`}
      >
        −
      </button>
      <button
        type="button"
        onClick={() => onZoomIndex(0)}
        disabled={zoomIndex === 0}
        title="Fit the page to the pane"
        className={`min-w-[3.25rem] ${buttonClassName} tabular-nums`}
      >
        {pdfZoomLabel(zoom)}
      </button>
      <button
        type="button"
        onClick={() => onZoomIndex(Math.min(zoomIndex + 1, last))}
        disabled={zoomIndex === last}
        title="Zoom in"
        aria-label="Zoom in"
        className={`${buttonClassName} disabled:opacity-40`}
      >
        +
      </button>
    </div>
  );
}

/**
 * The zoom of one screen's previews: where the − / + buttons stand now, and
 * the zoom this user's account keeps for the screen (what it opens at).
 */
export type KeptPreviewZoom = {
  screen: PreviewZoomScreen;
  zoomIndex: number;
  setZoomIndex: (index: number) => void;
  zoom: PdfZoom;
  /** The zoom the screen opens at for this account. */
  keptZoom: PdfZoom;
  /** Called once the account's zoom has been saved. */
  onKept: (zoom: PdfZoom) => void;
};

/**
 * Zoom state for a screen whose previews open at the zoom the signed-in user
 * chose to keep. `keptZoom` is what the server read for this account as the
 * page was drawn.
 */
export function useKeptPreviewZoom(
  screen: PreviewZoomScreen,
  keptZoom: PdfZoom,
): KeptPreviewZoom {
  const [kept, setKept] = useState<PdfZoom>(keptZoom);
  const [zoomIndex, setZoomIndex] = useState(() => pdfZoomIndex(keptZoom));
  const onKept = useCallback((zoom: PdfZoom) => setKept(zoom), []);
  return {
    screen,
    zoomIndex,
    setZoomIndex,
    zoom: PDF_ZOOM_STEPS[zoomIndex] ?? 1,
    keptZoom: kept,
    onKept,
  };
}

/**
 * "Keep zoom", beside the zoom buttons: after a yes on the confirm popup,
 * every preview on this screen opens at the zoom showing now, for the
 * signed-in user's account (on any computer). Off while the zoom showing is
 * the one already kept.
 */
export function KeepZoomButton({
  kept,
  className = defaultButtonClassName,
}: {
  kept: KeptPreviewZoom;
  className?: string;
}) {
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const { screen, zoom, keptZoom, onKept } = kept;
  const screenName = PREVIEW_ZOOM_SCREENS[screen];
  const isKept = zoom === keptZoom;
  const label = pdfZoomLabel(zoom);
  const opensAt = zoom === 1 ? "fitted to the pane" : `at ${label}`;

  async function keep() {
    const confirmed = await confirm({
      title: "Keep this zoom?",
      message: `Every preview on the ${screenName} screen will open ${opensAt} for your account, on any computer.\n\nRight now it opens ${
        keptZoom === 1 ? "fitted to the pane" : `at ${pdfZoomLabel(keptZoom)}`
      }. You can change it again the same way.`,
      confirmLabel: zoom === 1 ? "Keep Fit" : `Keep ${label}`,
    });
    if (!confirmed) {
      return;
    }
    setSaving(true);
    try {
      const result = await savePreviewZoom(screen, zoom);
      if (isActionError(result)) {
        toast.error(result.error);
        return;
      }
      onKept(zoom);
      toast.success(`${screenName} previews now open ${opensAt}.`);
    } catch (caught) {
      toast.error(describeActionFailure(caught, "The zoom could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void keep()}
      disabled={isKept || saving}
      data-keep-zoom={isKept ? "kept" : "changed"}
      title={
        isKept
          ? `Previews on this screen already open ${opensAt} for your account`
          : `Open every preview on this screen ${opensAt}, for your account`
      }
      className={`${className} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {saving ? "Saving…" : "Keep zoom"}
    </button>
  );
}
