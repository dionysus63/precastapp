/**
 * Renders the purchase order PDF with sample data, so a layout change can be
 * looked at without a database.
 *
 * Run with: npx tsx scripts/render-purchase-order-samples.ts [outDir] [lineCount]
 * A lineCount of "quote" renders an order placed against the vendor's quote.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  renderPurchaseOrderPdf,
  type PurchaseOrderPdfData,
  type PurchaseOrderPdfLine,
} from "../lib/purchase-order-pdf";

const SAMPLE_LINES: PurchaseOrderPdfLine[] = [
  {
    itemCode: "S1R3636",
    description:
      'Access door, single leaf, 36" x 36" clear opening, aluminum, 300 psf, stainless steel hardware, with lift assist',
    quantity: "4",
    unit: "EA",
    unitPrice: "$1,185.00",
    amount: "$4,740.00",
  },
  {
    itemCode: "W2R4872",
    description:
      'Access door, double leaf, 48" x 72" clear opening, aluminum, channel frame with drain, H-20 loading',
    quantity: "2",
    unit: "EA",
    unitPrice: "$3,460.00",
    amount: "$6,920.00",
  },
  {
    itemCode: "S1R3030",
    description: 'Access door, single leaf, 30" x 30" clear opening, aluminum, 300 psf',
    quantity: "6",
    unit: "EA",
    unitPrice: "$985.00",
    amount: "$5,910.00",
  },
  {
    itemCode: "SG3636",
    description: 'Safety grate, hinged, 36" x 36", safety orange',
    quantity: "4",
    unit: "EA",
    unitPrice: "$412.50",
    amount: "$1,650.00",
  },
  {
    itemCode: "LOCK-SS",
    description: "Slam lock, stainless steel, with removable key",
    quantity: "10",
    unit: "EA",
    unitPrice: "$68.00",
    amount: "$680.00",
  },
  {
    itemCode: "FREIGHT",
    description: "Freight to Brookhaven, NY",
    quantity: "1",
    unit: "LS",
    unitPrice: "$475.00",
    amount: "$475.00",
  },
];

function quoteOnlySampleData(): PurchaseOrderPdfData {
  return {
    ...sampleData(0),
    quote: { number: "Q122819", date: "11/17/2026" },
    total: "$30,318.00",
    notes: "Job tag: STOCK. Ship via ODFL, call 24 hours before delivery.",
  };
}

function sampleData(lineCount: number): PurchaseOrderPdfData {
  const lines = Array.from(
    { length: lineCount },
    (_, index) => SAMPLE_LINES[index % SAMPLE_LINES.length]!,
  );
  return {
    poNumber: "HA-0001",
    orderDate: "11/17/2026",
    expectedDate: "12/8/2026",
    orderedBy: "Nick",
    vendor: {
      name: "Halliday Products",
      lines: [
        "1234 Example Road",
        "Orlando, FL 32810",
        "Attn: Inside Sales",
        "(555) 010-0142",
      ],
    },
    shipTo: {
      name: "Long Island Precast",
      lines: ["20 Stiriz Road", "Brookhaven, NY 11719", "(631) 286-0240"],
    },
    lines,
    total: lineCount === SAMPLE_LINES.length ? "$20,375.00" : "$0.00",
    notes:
      "Deliver to the plant Monday to Friday, 7:00 AM to 2:30 PM. Call 24 hours before delivery.\nPer your quote dated 11/12/2026. Mark every crate with our purchase order number.",
    companyLine:
      "Long Island Precast   |   20 Stiriz Road, Brookhaven, NY 11719   |   (631) 286-0240",
  };
}

async function main() {
  const outDir = path.resolve(process.argv[2] ?? "purchase-order-samples");
  const quoteOnly = process.argv[3] === "quote";
  const lineCount = Number(process.argv[3] ?? SAMPLE_LINES.length);
  await mkdir(outDir, { recursive: true });
  const headerImagePng = await readFile(
    path.join(process.cwd(), "assets", "templates", "lip-header.png"),
  );
  const bytes = await renderPurchaseOrderPdf(
    quoteOnly ? quoteOnlySampleData() : sampleData(lineCount),
    { headerImagePng },
  );
  const file = path.join(
    outDir,
    quoteOnly ? "purchase-order-quote-only-sample.pdf" : "purchase-order-sample.pdf",
  );
  await writeFile(file, bytes);
  console.log(file);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
