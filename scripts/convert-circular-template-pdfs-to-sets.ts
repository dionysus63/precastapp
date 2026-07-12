/**
 * One-time migration: turn each circular template's uploaded PDF
 * (StructureTemplatePdf) into a named CIRCULAR Sheet PDF Set and assign it
 * via rectPdfSetId — unifying circular templates with the shared-set model
 * rectangular templates already use.
 *
 * A circular set holds ONE file stored with {hasTopSlab:false,
 * hasBaseSlab:false}. Templates that already have a set assigned are skipped.
 * If a template has several legacy PDF rows, the latest-updated one wins.
 *
 * Usage:
 *   npx tsx scripts/convert-circular-template-pdfs-to-sets.ts --dry-run
 *   npx tsx scripts/convert-circular-template-pdfs-to-sets.ts
 *   npx tsx scripts/convert-circular-template-pdfs-to-sets.ts --delete-old
 *
 * Default keeps the old StructureTemplatePdf rows dormant (rollback safety);
 * --delete-old removes the converted template's legacy rows and files.
 */
import { prisma } from "@/lib/prisma";
import { saveRectPdfSetFile } from "@/lib/rect-pdf-set-service";
import {
  deleteTemplatePdf,
  readTemplatePdfBytes,
} from "@/lib/structure-template-pdf-service";

async function uniqueSetName(base: string): Promise<string> {
  let candidate = base;
  for (let n = 2; ; n += 1) {
    const clash = await prisma.rectSheetPdfSet.findFirst({
      where: { name: candidate },
      select: { id: true },
    });
    if (!clash) {
      return candidate;
    }
    candidate = `${base} (${n})`;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const deleteOld = args.includes("--delete-old");

  const templates = await prisma.structureTemplate.findMany({
    where: { shape: "CIRCULAR", templatePdfs: { some: {} } },
    include: { templatePdfs: { orderBy: { updatedAt: "desc" } } },
    orderBy: { name: "asc" },
  });

  let converted = 0;
  let skipped = 0;

  for (const template of templates) {
    if (template.rectPdfSetId) {
      console.log(`skip "${template.name}": already has a sheet PDF set`);
      skipped += 1;
      continue;
    }

    const source = template.templatePdfs[0];
    const extras = template.templatePdfs.length - 1;
    const setName = await uniqueSetName(template.name);

    if (dryRun) {
      console.log(
        `[dry-run] "${template.name}": would create CIRCULAR set "${setName}" from ${source.originalName}` +
          (extras > 0 ? ` (${extras} older PDF row(s) ignored)` : ""),
      );
      converted += 1;
      continue;
    }

    const bytes = await readTemplatePdfBytes(source);
    const set = await prisma.rectSheetPdfSet.create({
      data: { name: setName, shape: "CIRCULAR" },
    });
    await saveRectPdfSetFile(
      prisma,
      set.id,
      { hasTopSlab: false, hasBaseSlab: false },
      new File([Buffer.from(bytes)], source.originalName, {
        type: "application/pdf",
      }),
    );
    await prisma.structureTemplate.update({
      where: { id: template.id },
      data: { rectPdfSetId: set.id },
    });
    console.log(
      `"${template.name}": created set "${setName}" from ${source.originalName}` +
        (extras > 0 ? ` (${extras} older PDF row(s) left dormant)` : ""),
    );
    converted += 1;

    if (deleteOld) {
      for (const row of template.templatePdfs) {
        await deleteTemplatePdf(prisma, row.id);
      }
      console.log(
        `  deleted ${template.templatePdfs.length} legacy template PDF row(s)`,
      );
    }
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}done: ${converted} converted, ${skipped} skipped`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
