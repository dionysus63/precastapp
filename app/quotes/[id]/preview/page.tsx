import { notFound } from "next/navigation";
import { QuotePreviewContent } from "@/components/quotes/quote-preview-content";
import { mapQuoteToDetailView } from "@/lib/quote-mapper";
import { getCompanyProfile } from "@/lib/app-settings";
import {
  companyLogoApiUrl,
  getCompanyLogoUpdatedAt,
} from "@/lib/company-logo";
import { withDatabaseRetry } from "@/lib/prisma";

type QuotePreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotePreviewPage({ params }: QuotePreviewPageProps) {
  const { id } = await params;

  const quote = await withDatabaseRetry((prisma) =>
    prisma.quote.findUnique({
      where: { id },
      include: {
        lineItems: {
          orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
        },
      },
    }),
  );

  if (!quote) {
    notFound();
  }

  const detail = mapQuoteToDetailView(quote);
  const [company, logoUpdatedAt] = await Promise.all([
    getCompanyProfile(),
    getCompanyLogoUpdatedAt(),
  ]);
  const logoUrl = logoUpdatedAt ? companyLogoApiUrl(logoUpdatedAt) : null;

  return (
    <QuotePreviewContent
      quote={detail}
      quoteId={quote.id}
      company={company}
      logoUrl={logoUrl}
    />
  );
}
