import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../lib/database-url";

async function main() {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(process.env.DATABASE_URL),
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const pipeProducts = await prisma.product.findMany({
    where: {
      productType: { in: ["ADS_PIPE", "PRECAST_PIPE"] },
      unit: "EA",
    },
    select: {
      id: true,
      productCode: true,
      productType: true,
      pipeLengthFeet: true,
      priceListItems: {
        select: {
          id: true,
          unitPrice: true,
          priceList: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (pipeProducts.length === 0) {
    console.log("No pipe products with unit EA found. Nothing to convert.");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  let convertedProducts = 0;
  let convertedPrices = 0;
  let skippedMissingLength = 0;

  for (const product of pipeProducts) {
    const lengthFeet = product.pipeLengthFeet
      ? Number(product.pipeLengthFeet.toString())
      : 0;

    if (!Number.isFinite(lengthFeet) || lengthFeet <= 0) {
      skippedMissingLength += 1;
      console.warn(
        `Skipping ${product.productCode}: missing or invalid pipeLengthFeet.`,
      );
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: { unit: "LF" },
      });

      for (const item of product.priceListItems) {
        const piecePrice = Number(item.unitPrice.toString());
        const pricePerFoot = Math.round((piecePrice / lengthFeet) * 100) / 100;
        await tx.priceListItem.update({
          where: { id: item.id },
          data: { unitPrice: pricePerFoot },
        });
        convertedPrices += 1;
        console.log(
          `  ${product.productCode} (${item.priceList.name}): $${piecePrice.toFixed(2)}/EA → $${pricePerFoot.toFixed(2)}/LF`,
        );
      }
    });

    convertedProducts += 1;
  }

  console.log("");
  console.log(
    `Converted ${convertedProducts} pipe product(s), ${convertedPrices} price list item(s).`,
  );
  if (skippedMissingLength > 0) {
    console.log(`Skipped ${skippedMissingLength} product(s) without stick length.`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
