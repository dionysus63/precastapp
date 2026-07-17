import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { QUOTE_PDF_INCLUDE } from "@/lib/quote-pdf-data";
import { generateQuotePdfBytes } from "@/lib/quote-pdf-fill";
import { buildQuoteAttachmentFilename } from "@/lib/quote-pdf-persist";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.QUOTES_VIEW);
    const { id } = await context.params;
    const download =
      new URL(request.url).searchParams.get("download") === "1";

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

    // Downloads carry the contractor-facing name ("{nickname} - {job name}");
    // inline previews keep the quote-numbered name.
    const filename = download
      ? await withDatabaseRetry((prisma) =>
          buildQuoteAttachmentFilename(
            quote,
            `quote-${quote.quoteNumber}`,
            prisma,
          ),
        )
      : `quote-${quote.quoteNumber}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Unauthorized or failed to generate preview.", {
      status: 403,
    });
  }
}
