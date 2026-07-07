import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { loadJobDeliverySchedule } from "@/lib/delivery-schedule-data";
import {
  buildDeliverySchedulePdfHtml,
  type DeliveryScheduleVariant,
} from "@/lib/delivery-schedule-pdf-html";
import { renderPdfBytesFromHtml } from "@/lib/quote-pdf";
import { sanitizeFilenamePart } from "@/lib/quote-pdf-path";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function parseVariant(value: string | null): DeliveryScheduleVariant | null {
  if (value == null || value === "" || value === "contractor") {
    return "contractor";
  }
  if (value === "internal") {
    return "internal";
  }
  return null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.DELIVERY_VIEW);
    const { jobId } = await context.params;
    const variant = parseVariant(
      new URL(request.url).searchParams.get("variant"),
    );
    if (!variant) {
      return new NextResponse("Unknown variant.", { status: 400 });
    }

    const schedule = await loadJobDeliverySchedule(jobId);
    if (!schedule) {
      return new NextResponse("Job not found.", { status: 404 });
    }

    const html = await buildDeliverySchedulePdfHtml(schedule, variant);
    const pdfBytes = await renderPdfBytesFromHtml(html);

    const jobNumberPart = sanitizeFilenamePart(schedule.job.jobNumber) || "job";
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="delivery-schedule-${jobNumberPart}-${variant}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Unauthorized or failed to generate schedule.", {
      status: 403,
    });
  }
}
