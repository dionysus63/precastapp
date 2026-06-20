import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../lib/database-url";
import { DEFAULT_APP_SETTINGS_DATA } from "../lib/app-settings";
import {
  DEFAULT_SEED_LOGO_PDF_PATH,
  seedLogoFromPdf,
} from "../lib/company-logo";

async function main() {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(process.env.DATABASE_URL),
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const year = new Date().getFullYear();

  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: DEFAULT_APP_SETTINGS_DATA,
    update: {},
  });

  const seededLogo = await seedLogoFromPdf(DEFAULT_SEED_LOGO_PDF_PATH);
  if (seededLogo) {
    console.log(`Seeded company logo at ${seededLogo}`);
  }

  await prisma.deliveryTicketSequence.upsert({
    where: { year },
    create: { year, lastNumber: 0 },
    update: {},
  });

  await prisma.invoiceSequence.upsert({
    where: { year },
    create: { year, lastNumber: 0 },
    update: {},
  });

  const priceList = await prisma.priceList.upsert({
    where: { name: "Standard 2026" },
    create: {
      name: "Standard 2026",
      isDefault: true,
      effectiveDate: new Date("2026-01-01"),
      notes: "Default price list seeded from product catalog.",
    },
    update: { isDefault: true },
  });

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", defaultPrice: { not: null } },
    select: { id: true, defaultPrice: true },
  });

  for (const product of products) {
    if (!product.defaultPrice) continue;
    await prisma.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: priceList.id,
          productId: product.id,
        },
      },
      create: {
        priceListId: priceList.id,
        productId: product.id,
        unitPrice: product.defaultPrice,
      },
      update: { unitPrice: product.defaultPrice },
    });
  }

  console.log(
    `Seed complete: price list "${priceList.name}" with ${products.length} item(s).`,
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
