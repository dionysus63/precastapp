import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { QUOTE_PDF_INCLUDE } from "@/lib/quote-pdf-data";
import { generateQuotePdfBytes } from "@/lib/quote-pdf-fill";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.QUOTES_VIEW);
    const { id } = await context.params;

    const quote = await withDatabaseRetry((prisma) =>
      prisma.quote.findUnique({
        where: { id },
        include: QUOTE_PDF_INCLUDE,
      }),
    );

    if (!quote) {
      return new NextResponse("Quote not found.", { status: 404 });
    }

    const pdfBytes = await generateQuotePdfBytes(quote);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="quote-${quote.quoteNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Unauthorized or failed to generate preview.", {
      status: 403,
    });
  }
}
