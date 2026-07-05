"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  commitWorkbookRowPrice,
  createDefaultOpening,
  createDefaultWorkbookRow,
  ensureRowOpenings,
  nextOpeningLabel,
  syncRowFromOpenings,
  type StructureWorkbookDefaults,
  type StructureWorkbookOpeningRow,
  type StructureWorkbookOptions,
  type StructureWorkbookRow,
} from "@/lib/quotes/structure-workbook";
import {
  findStructureMarker,
  relativeAngleFromOutlet,
  snapBearingDegrees,
  type PlanSheetMarkup,
} from "@/lib/quotes/plan-sheet-markup";
import { normalizeDegrees } from "@/lib/drill-sheet-diagram";
import {
  pipeSizesForMaterial,
  uniquePipeMaterials,
} from "@/components/quotes/structure-workbook/structure-workbook-pipe-options";

type TakeoffMode = "add_structure" | "draw_pipes" | "select";

type StructureWorkbookPlanTakeoffProps = {
  planSheetId: string;
  planName: string;
  pageNumber: number;
  onPageChange: (page: number) => void;
  markup: PlanSheetMarkup;
  onMarkupChange: (markup: PlanSheetMarkup) => void;
  rows: StructureWorkbookRow[];
  onRowsChange: (rows: StructureWorkbookRow[]) => void;
  options: StructureWorkbookOptions;
  defaults: StructureWorkbookDefaults;
  templates: StructureWorkbookOptions["templates"];
  pendingPlaceRowId: string | null;
  onPendingPlaceRowIdChange: (rowId: string | null) => void;
};

type PopupState =
  | { kind: "structure"; rowId: string }
  | { kind: "pipe"; rowId: string; openingId: string }
  | null;

type DragState = {
  rowKey: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  shiftKey: boolean;
};

const MIN_PIPE_LENGTH = 24;
const DEFAULT_PIPE_LENGTH = 80;

function bearingFromDelta(dx: number, dy: number): number {
  return normalizeDegrees((Math.atan2(dx, -dy) * 180) / Math.PI);
}

function pdfToScreen(
  point: { x: number; y: number },
  pdfWidth: number,
  pdfHeight: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  return {
    x: (point.x / pdfWidth) * canvasWidth,
    y: (point.y / pdfHeight) * canvasHeight,
  };
}

function screenToPdf(
  point: { x: number; y: number },
  pdfWidth: number,
  pdfHeight: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  return {
    x: (point.x / canvasWidth) * pdfWidth,
    y: (point.y / canvasHeight) * pdfHeight,
  };
}

function updateRowInList(
  rows: StructureWorkbookRow[],
  rowId: string,
  patch: (row: StructureWorkbookRow) => StructureWorkbookRow,
): StructureWorkbookRow[] {
  return rows.map((row) => (row.id === rowId ? patch(row) : row));
}

function commitRow(
  row: StructureWorkbookRow,
  options: StructureWorkbookOptions,
): StructureWorkbookRow {
  return commitWorkbookRowPrice(
    syncRowFromOpenings(ensureRowOpenings(row)),
    options,
    "DRILL_SHEET",
  );
}

export function StructureWorkbookPlanTakeoff({
  planSheetId,
  planName,
  pageNumber,
  onPageChange,
  markup,
  onMarkupChange,
  rows,
  onRowsChange,
  options,
  defaults,
  templates,
  pendingPlaceRowId,
  onPendingPlaceRowIdChange,
}: StructureWorkbookPlanTakeoffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);

  const [mode, setMode] = useState<TakeoffMode>("add_structure");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [pageCount, setPageCount] = useState(1);
  const [pdfSize, setPdfSize] = useState({ width: 612, height: 792 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderToken, setRenderToken] = useState(0);
  const [popup, setPopup] = useState<PopupState>(null);
  const [activeStructureRowId, setActiveStructureRowId] = useState<string | null>(
    null,
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const pipeMaterials = useMemo(
    () => uniquePipeMaterials(options.pipeOpeningSizes),
    [options.pipeOpeningSizes],
  );

  const placedRowKeys = useMemo(
    () =>
      new Set(
        markup.structures
          .filter((marker) => marker.page === pageNumber)
          .map((marker) => marker.rowKey),
      ),
    [markup.structures, pageNumber],
  );

  const unplacedRows = useMemo(
    () => rows.filter((row) => !placedRowKeys.has(row.id)),
    [rows, placedRowKeys],
  );

  const resolveLocalPoint = useCallback(
    (clientX: number, clientY: number) => {
      const viewport = viewportRef.current;
      if (!viewport || canvasSize.width <= 0) {
        return null;
      }
      const rect = viewport.getBoundingClientRect();
      const localX = (clientX - rect.left - pan.x) / zoom;
      const localY = (clientY - rect.top - pan.y) / zoom;
      return screenToPdf(
        { x: localX, y: localY },
        pdfSize.width,
        pdfSize.height,
        canvasSize.width,
        canvasSize.height,
      );
    },
    [canvasSize.height, canvasSize.width, pan.x, pan.y, pdfSize.height, pdfSize.width, zoom],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setIsRendering(true);
      setLoadError(null);
      pdfRef.current = null;

      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const response = await fetch(`/api/plan-sheets/${planSheetId}`, {
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error("Could not load plan PDF.");
        }

        const pdfBytes = await response.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
        if (cancelled) {
          return;
        }

        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setRenderToken((value) => value + 1);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load plan PDF.",
          );
          setIsRendering(false);
        }
      }
    }

    void loadPdf();
    return () => {
      cancelled = true;
      pdfRef.current = null;
    };
  }, [planSheetId]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !container) {
      return;
    }

    let cancelled = false;

    async function renderPage() {
      setIsRendering(true);
      setLoadError(null);

      try {
        const sheetIndex = Math.min(Math.max(pageNumber, 1), pdf!.numPages);
        const page = await pdf!.getPage(sheetIndex);
        if (cancelled) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        setPdfSize({ width: baseViewport.width, height: baseViewport.height });

        const containerWidth = container!.clientWidth || baseViewport.width;
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        canvas!.width = viewport.width;
        canvas!.height = viewport.height;
        setCanvasSize({ width: viewport.width, height: viewport.height });

        const context = canvas!.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Could not initialize PDF canvas.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas!.width, canvas!.height);

        await page.render({
          canvasContext: context,
          viewport,
          canvas: canvas!,
          background: "#ffffff",
        }).promise;
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to render plan page.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
    };
  }, [pageNumber, renderToken]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") {
        event.preventDefault();
        setSpaceHeld(true);
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setSpaceHeld(false);
        setIsPanning(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const patchMarkup = useCallback(
    (updater: (current: PlanSheetMarkup) => PlanSheetMarkup) => {
      onMarkupChange(updater(markup));
    },
    [markup, onMarkupChange],
  );

  const openStructurePopup = useCallback((rowId: string) => {
    setPopup({ kind: "structure", rowId });
    setActiveStructureRowId(rowId);
  }, []);

  const openPipePopup = useCallback((rowId: string, openingId: string) => {
    setPopup({ kind: "pipe", rowId, openingId });
    setActiveStructureRowId(rowId);
  }, []);

  const placeStructureAt = useCallback(
    (pdfPoint: { x: number; y: number }) => {
      let nextRows = rows;
      let rowId = pendingPlaceRowId;

      if (rowId) {
        onPendingPlaceRowIdChange(null);
      } else {
        const created = ensureRowOpenings({
          ...createDefaultWorkbookRow(templates, rows, defaults),
          openings: [createDefaultOpening("A")],
        });
        rowId = created.id;
        nextRows = [...rows, created];
        onRowsChange(nextRows);
      }

      if (!rowId) {
        return;
      }

      patchMarkup((current) => ({
        ...current,
        structures: [
          ...current.structures.filter(
            (marker) => !(marker.rowKey === rowId && marker.page === pageNumber),
          ),
          {
            rowKey: rowId,
            structureNumber:
              nextRows.find((row) => row.id === rowId)?.structureNumber ?? "",
            page: pageNumber,
            x: pdfPoint.x,
            y: pdfPoint.y,
          },
        ],
      }));

      openStructurePopup(rowId);
      setMode("draw_pipes");
    },
    [
      defaults,
      onPendingPlaceRowIdChange,
      onRowsChange,
      openStructurePopup,
      pageNumber,
      patchMarkup,
      pendingPlaceRowId,
      rows,
      templates,
    ],
  );

  const finishPipeDrag = useCallback(
    (drag: DragState) => {
      const dx = drag.currentX - drag.startX;
      const dy = drag.currentY - drag.startY;
      const length = Math.hypot(dx, dy);
      if (length < MIN_PIPE_LENGTH) {
        return;
      }

      const bearing = snapBearingDegrees(
        bearingFromDelta(dx, dy),
        5,
        drag.shiftKey,
      );
      const row = rows.find((entry) => entry.id === drag.rowKey);
      if (!row) {
        return;
      }

      const marker = findStructureMarker(markup, drag.rowKey, pageNumber);
      if (!marker) {
        return;
      }

      let nextRow = ensureRowOpenings(row);
      const existingPipes = markup.pipes.filter(
        (line) => line.rowKey === drag.rowKey,
      );
      const isOutlet = existingPipes.length === 0;
      const outletBearing = isOutlet
        ? bearing
        : (marker.outletBearingDegrees ?? bearing);

      let opening: StructureWorkbookOpeningRow;
      if (isOutlet) {
        opening = nextRow.openings[0] ?? createDefaultOpening("A");
        nextRow = {
          ...nextRow,
          openings: [
            {
              ...opening,
              label: "A",
              angleDegrees: "0",
            },
            ...nextRow.openings.slice(1),
          ],
        };
      } else {
        const label = nextOpeningLabel(nextRow.openings.length);
        opening = createDefaultOpening(label);
        nextRow = {
          ...nextRow,
          openings: [
            ...nextRow.openings,
            {
              ...opening,
              angleDegrees: String(
                relativeAngleFromOutlet(bearing, outletBearing),
              ),
            },
          ],
        };
      }

      const relativeAngle = isOutlet
        ? 0
        : relativeAngleFromOutlet(bearing, outletBearing);

      patchMarkup((current) => ({
        structures: current.structures.map((entry) =>
          entry.rowKey === drag.rowKey && entry.page === pageNumber
            ? {
                ...entry,
                outletBearingDegrees: isOutlet
                  ? outletBearing
                  : entry.outletBearingDegrees ?? outletBearing,
              }
            : entry,
        ),
        pipes: [
          ...current.pipes.filter((line) => line.openingKey !== opening.id),
          {
            openingKey: opening.id,
            openingLabel: opening.label,
            rowKey: drag.rowKey,
            angleDegrees: relativeAngle,
            length: Math.max(length, DEFAULT_PIPE_LENGTH),
            bearingDegrees: bearing,
          },
        ],
      }));

      const committed = commitRow(nextRow, options);
      onRowsChange(updateRowInList(rows, drag.rowKey, () => committed));
      openPipePopup(drag.rowKey, opening.id);
    },
    [markup, onRowsChange, openPipePopup, options, pageNumber, patchMarkup, rows],
  );

  function handleViewportPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (spaceHeld || event.button === 1) {
      setIsPanning(true);
      setPanStart({
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      });
      return;
    }

    const pdfPoint = resolveLocalPoint(event.clientX, event.clientY);
    if (!pdfPoint) {
      return;
    }

    if (mode === "add_structure") {
      placeStructureAt(pdfPoint);
      return;
    }

    if (mode === "draw_pipes") {
      const hit = markup.structures.find(
        (marker) =>
          marker.page === pageNumber &&
          Math.hypot(pdfPoint.x - marker.x, pdfPoint.y - marker.y) < 18,
      );
      if (!hit) {
        return;
      }
      const screen = pdfToScreen(
        hit,
        pdfSize.width,
        pdfSize.height,
        canvasSize.width,
        canvasSize.height,
      );
      setActiveStructureRowId(hit.rowKey);
      setDragState({
        rowKey: hit.rowKey,
        startX: screen.x,
        startY: screen.y,
        currentX: screen.x,
        currentY: screen.y,
        shiftKey: event.shiftKey,
      });
      return;
    }

    if (mode === "select") {
      const structureHit = markup.structures.find(
        (marker) =>
          marker.page === pageNumber &&
          Math.hypot(pdfPoint.x - marker.x, pdfPoint.y - marker.y) < 18,
      );
      if (structureHit) {
        openStructurePopup(structureHit.rowKey);
        return;
      }

      for (const line of markup.pipes) {
        const marker = findStructureMarker(markup, line.rowKey, pageNumber);
        if (!marker) {
          continue;
        }
        const end = pdfToScreen(
          {
            x:
              marker.x +
              Math.sin((line.bearingDegrees * Math.PI) / 180) * line.length,
            y:
              marker.y -
              Math.cos((line.bearingDegrees * Math.PI) / 180) * line.length,
          },
          pdfSize.width,
          pdfSize.height,
          canvasSize.width,
          canvasSize.height,
        );
        const start = pdfToScreen(
          marker,
          pdfSize.width,
          pdfSize.height,
          canvasSize.width,
          canvasSize.height,
        );
        const click = pdfToScreen(
          pdfPoint,
          pdfSize.width,
          pdfSize.height,
          canvasSize.width,
          canvasSize.height,
        );
        const dist = distanceToSegment(click, start, end);
        if (dist < 8) {
          openPipePopup(line.rowKey, line.openingKey);
          return;
        }
      }
    }
  }

  function handleViewportPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (isPanning) {
      setPan({
        x: panStart.panX + (event.clientX - panStart.x),
        y: panStart.panY + (event.clientY - panStart.y),
      });
      return;
    }

    if (dragState) {
      const pdfPoint = resolveLocalPoint(event.clientX, event.clientY);
      if (!pdfPoint) {
        return;
      }
      const screen = pdfToScreen(
        pdfPoint,
        pdfSize.width,
        pdfSize.height,
        canvasSize.width,
        canvasSize.height,
      );
      setDragState({
        ...dragState,
        currentX: screen.x,
        currentY: screen.y,
        shiftKey: event.shiftKey,
      });
    }
  }

  function handleViewportPointerUp() {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (dragState) {
      finishPipeDrag(dragState);
      setDragState(null);
    }
  }

  function distanceToSegment(
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
      ),
    );
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
  }

  function updateStructureField(
    rowId: string,
    patch: Partial<StructureWorkbookRow>,
  ) {
    if (patch.structureNumber != null) {
      patchMarkup((current) => ({
        ...current,
        structures: current.structures.map((marker) =>
          marker.rowKey === rowId
            ? { ...marker, structureNumber: patch.structureNumber }
            : marker,
        ),
      }));
    }
    onRowsChange(
      updateRowInList(rows, rowId, (row) =>
        commitRow({ ...row, ...patch }, options),
      ),
    );
  }

  function updateOpeningField(
    rowId: string,
    openingId: string,
    patch: Partial<StructureWorkbookOpeningRow>,
  ) {
    onRowsChange(
      updateRowInList(rows, rowId, (row) => {
        const next = {
          ...row,
          openings: row.openings.map((opening) =>
            opening.id === openingId ? { ...opening, ...patch } : opening,
          ),
        };
        return commitRow(next, options);
      }),
    );
  }

  function deleteStructure(rowId: string) {
    patchMarkup((current) => ({
      structures: current.structures.filter((marker) => marker.rowKey !== rowId),
      pipes: current.pipes.filter((line) => line.rowKey !== rowId),
    }));
    onRowsChange(rows.filter((row) => row.id !== rowId));
    setPopup(null);
  }

  function deletePipe(rowId: string, openingId: string) {
    patchMarkup((current) => ({
      ...current,
      pipes: current.pipes.filter((line) => line.openingKey !== openingId),
    }));
    onRowsChange(
      updateRowInList(rows, rowId, (row) => {
        const nextOpenings = row.openings.filter(
          (opening) => opening.id !== openingId,
        );
        return commitRow({ ...row, openings: nextOpenings }, options);
      }),
    );
    setPopup(null);
  }

  const popupRow =
    popup?.kind === "structure" || popup?.kind === "pipe"
      ? rows.find((row) => row.id === popup.rowId)
      : null;
  const popupOpening =
    popup?.kind === "pipe"
      ? popupRow?.openings.find((opening) => opening.id === popup.openingId)
      : null;

  const activeDragBearing =
    dragState != null
      ? snapBearingDegrees(
          bearingFromDelta(
            dragState.currentX - dragState.startX,
            dragState.currentY - dragState.startY,
          ),
          5,
          dragState.shiftKey,
        )
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <p className="mr-2 text-xs font-semibold text-slate-700">{planName}</p>
        <div className="inline-flex rounded-lg border border-slate-200 p-1">
          {(
            [
              ["add_structure", "Add structure"],
              ["draw_pipes", "Draw pipes"],
              ["select", "Select / edit"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                mode === value
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
            className="rounded border border-slate-200 px-2 py-1 text-[11px]"
          >
            −
          </button>
          <span className="text-[11px] text-slate-600">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(3, value + 0.1))}
            className="rounded border border-slate-200 px-2 py-1 text-[11px]"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="rounded border border-slate-200 px-2 py-1 text-[11px]"
          >
            Reset view
          </button>
          <label className="flex items-center gap-1 text-[11px] text-slate-600">
            Page
            <select
              value={pageNumber}
              onChange={(event) => onPageChange(Number(event.target.value))}
              className="rounded border border-slate-200 px-1 py-0.5"
            >
              {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                (page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </div>

      {unplacedRows.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Unplaced structures</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unplacedRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  onPendingPlaceRowIdChange(row.id);
                  setMode("add_structure");
                }}
                className="rounded border border-amber-300 bg-white px-2 py-1 font-medium hover:bg-amber-100"
              >
                Place {row.structureNumber || "structure"} on plan
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="relative max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) =>
            Math.min(3, Math.max(0.5, value + (event.deltaY > 0 ? -0.08 : 0.08))),
          );
        }}
      >
        <div
          ref={viewportRef}
          className={`relative min-h-[420px] ${spaceHeld || isPanning ? "cursor-grab" : mode === "add_structure" ? "cursor-crosshair" : mode === "draw_pipes" ? "cursor-cell" : "cursor-default"}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onPointerLeave={handleViewportPointerUp}
        >
          <canvas ref={canvasRef} className="block bg-white" />
          {canvasSize.width > 0 ? (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={canvasSize.width}
              height={canvasSize.height}
            >
              {markup.structures
                .filter((marker) => marker.page === pageNumber)
                .map((marker) => {
                  const row = rows.find((entry) => entry.id === marker.rowKey);
                  const screen = pdfToScreen(
                    marker,
                    pdfSize.width,
                    pdfSize.height,
                    canvasSize.width,
                    canvasSize.height,
                  );
                  const isActive = activeStructureRowId === marker.rowKey;
                  return (
                    <g key={`${marker.rowKey}-${marker.page}`}>
                      <circle
                        cx={screen.x}
                        cy={screen.y}
                        r={14}
                        fill={isActive ? "#0ea5e9" : "#1e293b"}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                      <text
                        x={screen.x}
                        y={screen.y + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="700"
                      >
                        {row?.structureNumber || "?"}
                      </text>
                    </g>
                  );
                })}

              {markup.pipes.map((line) => {
                const marker = findStructureMarker(
                  markup,
                  line.rowKey,
                  pageNumber,
                );
                if (!marker) {
                  return null;
                }
                const start = pdfToScreen(
                  marker,
                  pdfSize.width,
                  pdfSize.height,
                  canvasSize.width,
                  canvasSize.height,
                );
                const end = {
                  x:
                    start.x +
                    Math.sin((line.bearingDegrees * Math.PI) / 180) *
                      (line.length / pdfSize.width) *
                      canvasSize.width,
                  y:
                    start.y -
                    Math.cos((line.bearingDegrees * Math.PI) / 180) *
                      (line.length / pdfSize.height) *
                      canvasSize.height,
                };
                return (
                  <line
                    key={line.openingKey}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#0284c7"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                );
              })}

              {dragState ? (
                <g>
                  <line
                    x1={dragState.startX}
                    y1={dragState.startY}
                    x2={dragState.currentX}
                    y2={dragState.currentY}
                    stroke="#f97316"
                    strokeWidth={3}
                    strokeDasharray="6 4"
                  />
                  <ProtractorRing
                    cx={dragState.startX}
                    cy={dragState.startY}
                    radius={56}
                    bearing={activeDragBearing ?? 0}
                  />
                  <text
                    x={dragState.startX}
                    y={dragState.startY - 68}
                    textAnchor="middle"
                    fill="#c2410c"
                    fontSize="12"
                    fontWeight="700"
                  >
                    {activeDragBearing ?? 0}°
                  </text>
                </g>
              ) : null}
            </svg>
          ) : null}
        </div>

        {isRendering ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-slate-500">
            Loading plan…
          </div>
        ) : null}
        {loadError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white px-4 text-center text-sm text-red-700">
            {loadError}
          </div>
        ) : null}
      </div>

      <p className="text-[11px] text-slate-500">
        Hold Space to pan. Pipe angles snap to 5°; hold Shift while dragging for
        free angle. First pipe drawn from a structure is the outlet (0°).
      </p>

      {popup?.kind === "structure" && popupRow ? (
        <StructurePopup
          row={popupRow}
          options={options}
          onClose={() => setPopup(null)}
          onDelete={() => deleteStructure(popup.rowId)}
          onChange={(patch) => updateStructureField(popup.rowId, patch)}
        />
      ) : null}

      {popup?.kind === "pipe" && popupRow && popupOpening ? (
        <PipePopup
          opening={popupOpening}
          pipeMaterials={pipeMaterials}
          pipeOpeningSizes={options.pipeOpeningSizes}
          onClose={() => setPopup(null)}
          onDelete={() => deletePipe(popup.rowId, popup.openingId)}
          onChange={(patch) =>
            updateOpeningField(popup.rowId, popup.openingId, patch)
          }
        />
      ) : null}
    </div>
  );
}

function ProtractorRing({
  cx,
  cy,
  radius,
  bearing,
}: {
  cx: number;
  cy: number;
  radius: number;
  bearing: number;
}) {
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 15) {
    const outer = polarToScreenPoint(cx, cy, radius, deg);
    const inner = polarToScreenPoint(cx, cy, radius - (deg % 45 === 0 ? 10 : 5), deg);
    ticks.push(
      <line
        key={deg}
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        stroke="#94a3b8"
        strokeWidth={deg % 45 === 0 ? 2 : 1}
      />,
    );
  }

  const needle = polarToScreenPoint(cx, cy, radius - 4, bearing);

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="rgba(255,255,255,0.75)"
        stroke="#cbd5e1"
      />
      {ticks}
      <line
        x1={cx}
        y1={cy}
        x2={needle.x}
        y2={needle.y}
        stroke="#ea580c"
        strokeWidth={3}
      />
    </g>
  );
}

function polarToScreenPoint(
  cx: number,
  cy: number,
  radius: number,
  bearingDegrees: number,
) {
  const radians = (bearingDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(radians),
    y: cy - radius * Math.cos(radians),
  };
}

function StructurePopup({
  row,
  options,
  onClose,
  onDelete,
  onChange,
}: {
  row: StructureWorkbookRow;
  options: StructureWorkbookOptions;
  onClose: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<StructureWorkbookRow>) => void;
}) {
  const selectedTemplate = options.templates.find(
    (template) => template.id === row.templateId,
  );
  const diameters = selectedTemplate?.diameters ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Structure</p>
            <p className="text-xs text-slate-500">
              Template, diameter, casting, and rim elevation.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400">
            ✕
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs">
            Structure #
            <input
              value={row.structureNumber}
              onChange={(event) =>
                onChange({ structureNumber: event.target.value })
              }
              className="rounded border border-slate-200 px-2 py-1.5"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Template
            <select
              value={row.templateId}
              onChange={(event) => onChange({ templateId: event.target.value })}
              className="rounded border border-slate-200 px-2 py-1.5"
            >
              {options.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Diameter (ft)
            <select
              value={row.diameterFeet}
              onChange={(event) =>
                onChange({ diameterFeet: event.target.value })
              }
              className="rounded border border-slate-200 px-2 py-1.5"
            >
              <option value="">Select…</option>
              {diameters.map((diameter) => (
                <option
                  key={diameter.insideDiameterFeet}
                  value={String(diameter.insideDiameterFeet)}
                >
                  {diameter.insideDiameterFeet}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Casting
            <select
              value={row.castingProductId}
              onChange={(event) =>
                onChange({ castingProductId: event.target.value })
              }
              className="rounded border border-slate-200 px-2 py-1.5"
            >
              <option value="">None</option>
              {options.castings.map((casting) => (
                <option key={casting.id} value={casting.id}>
                  {casting.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Rim elevation
            <input
              value={row.rimElevation}
              onChange={(event) =>
                onChange({ rimElevation: event.target.value })
              }
              className="rounded border border-slate-200 px-2 py-1.5"
              placeholder="e.g. 512.50"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700"
          >
            Delete structure
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PipePopup({
  opening,
  pipeMaterials,
  pipeOpeningSizes,
  onClose,
  onDelete,
  onChange,
}: {
  opening: StructureWorkbookOpeningRow;
  pipeMaterials: string[];
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"];
  onClose: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<StructureWorkbookOpeningRow>) => void;
}) {
  const sizes = pipeSizesForMaterial(pipeOpeningSizes, opening.pipeMaterial);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Opening {opening.label}
            </p>
            <p className="text-xs text-slate-500">
              Material, size, and invert elevation.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400">
            ✕
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs">
            Material
            <select
              value={opening.pipeMaterial}
              onChange={(event) =>
                onChange({
                  pipeMaterial: event.target.value,
                  pipeSizeInches: "",
                })
              }
              className="rounded border border-slate-200 px-2 py-1.5"
            >
              <option value="">Select…</option>
              {pipeMaterials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Size (in)
            <select
              value={opening.pipeSizeInches}
              onChange={(event) =>
                onChange({ pipeSizeInches: event.target.value })
              }
              className="rounded border border-slate-200 px-2 py-1.5"
            >
              <option value="">Select…</option>
              {sizes.map((size) => (
                <option key={size} value={String(size)}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Invert elevation
            <input
              value={opening.invertElevation}
              onChange={(event) =>
                onChange({ invertElevation: event.target.value })
              }
              className="rounded border border-slate-200 px-2 py-1.5"
              placeholder="e.g. 498.25"
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Angle: {opening.angleDegrees || "0"}° from outlet
          </p>
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700"
          >
            Delete pipe
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
