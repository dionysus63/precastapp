"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { savePreviewZoom } from "@/app/settings/users/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { describeActionFailure, isActionError } from "@/lib/action-result";
import {
  PDF_ZOOM_STEPS,
  PREVIEW_ZOOM_SCREENS,
  pdfZoomIndex,
  pdfZoomLabel,
  type KeptPreviewZooms,
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

type KeptZoomsContextValue = {
  kept: KeptPreviewZooms;
  setKept: (screen: PreviewZoomScreen, zoom: PdfZoom) => void;
};

const KeptZoomsContext = createContext<KeptZoomsContextValue>({
  kept: {},
  setKept: () => undefined,
});

/**
 * Hands every preview on the page the zooms the signed-in user's account
 * keeps (read by the server as the page was drawn), and what "Keep zoom"
 * saved since, so two previews of one screen agree without a reload.
 */
export function PreviewZoomProvider({
  kept,
  children,
}: {
  kept: KeptPreviewZooms;
  children: ReactNode;
}) {
  const serverKey = JSON.stringify(kept);
  // Kept in this window since the server's answer above; a newer answer
  // from the server (the page drawn again) wins.
  const [saved, setSaved] = useState<{ since: string; kept: KeptPreviewZooms }>(
    { since: serverKey, kept: {} },
  );
  const setKept = useCallback(
    (screen: PreviewZoomScreen, zoom: PdfZoom) =>
      setSaved((current) => ({
        since: serverKey,
        kept: {
          ...(current.since === serverKey ? current.kept : {}),
          [screen]: zoom,
        },
      })),
    [serverKey],
  );
  const value = useMemo<KeptZoomsContextValue>(
    () => ({
      kept: {
        ...(JSON.parse(serverKey) as KeptPreviewZooms),
        ...(saved.since === serverKey ? saved.kept : {}),
      },
      setKept,
    }),
    [serverKey, saved, setKept],
  );
  return (
    <KeptZoomsContext.Provider value={value}>
      {children}
    </KeptZoomsContext.Provider>
  );
}

/** Where a preview's zoom stands, and the zoom its screen keeps. */
export type PreviewZoomState = {
  /** The screen whose kept zoom this is; null: a preview that keeps none. */
  screen: PreviewZoomScreen | null;
  zoomIndex: number;
  setZoomIndex: (index: number) => void;
  zoom: PdfZoom;
  /** The zoom the screen opens at for this user's account. */
  keptZoom: PdfZoom;
  /** Called once the account's zoom has been saved. */
  onKept: (zoom: PdfZoom) => void;
};

/**
 * Zoom state of one preview. With a `screen`, it opens at the zoom the
 * signed-in user's account keeps for that screen, and jumps to a newly kept
 * zoom (so every preview on the screen shows what "Keep zoom" just saved).
 */
export function usePreviewZoom(
  screen: PreviewZoomScreen | null = null,
): PreviewZoomState {
  const { kept, setKept } = useContext(KeptZoomsContext);
  const keptZoom: PdfZoom = (screen ? kept[screen] : undefined) ?? 1;
  const [zoomIndex, setZoomIndex] = useState(() => pdfZoomIndex(keptZoom));
  const [seenKept, setSeenKept] = useState(keptZoom);
  if (seenKept !== keptZoom) {
    setSeenKept(keptZoom);
    setZoomIndex(pdfZoomIndex(keptZoom));
  }
  const onKept = useCallback(
    (zoom: PdfZoom) => {
      if (screen) {
        setKept(screen, zoom);
      }
    },
    [screen, setKept],
  );
  return {
    screen,
    zoomIndex,
    setZoomIndex,
    zoom: PDF_ZOOM_STEPS[zoomIndex] ?? 1,
    keptZoom,
    onKept,
  };
}

function opensAt(zoom: PdfZoom): string {
  return zoom === 1 ? "fitted to the pane" : `at ${pdfZoomLabel(zoom)}`;
}

/**
 * "Keep zoom", beside the zoom buttons: after a yes on the confirm popup,
 * every preview on this screen opens at the zoom showing now, for the
 * signed-in user's account (on any computer). Off while the zoom showing is
 * the one already kept. Draws nothing for a preview that keeps no zoom.
 */
export function KeepZoomButton({
  zoom: state,
  className = defaultButtonClassName,
}: {
  zoom: PreviewZoomState;
  className?: string;
}) {
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const { screen, zoom, keptZoom, onKept } = state;
  if (!screen) {
    return null;
  }
  const where = PREVIEW_ZOOM_SCREENS[screen];
  const isKept = zoom === keptZoom;

  async function keep(screen: PreviewZoomScreen) {
    const confirmed = await confirm({
      title: "Keep this zoom?",
      message: `Every preview on ${where} will open ${opensAt(zoom)} for your account, on any computer.\n\nRight now it opens ${opensAt(keptZoom)}. You can change it again the same way.`,
      confirmLabel: `Keep ${pdfZoomLabel(zoom)}`,
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
      toast.success(`Previews on ${where} now open ${opensAt(zoom)}.`);
    } catch (caught) {
      toast.error(describeActionFailure(caught, "The zoom could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void keep(screen)}
      disabled={isKept || saving}
      data-keep-zoom={isKept ? "kept" : "changed"}
      title={
        isKept
          ? `Previews on ${where} already open ${opensAt(zoom)} for your account`
          : `Open every preview on ${where} ${opensAt(zoom)}, for your account`
      }
      className={`${className} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {saving ? "Saving…" : "Keep zoom"}
    </button>
  );
}
