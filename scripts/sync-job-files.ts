import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../lib/database-url";
import { syncAllJobFilesFromDisk } from "../lib/job-files-service";

async function main() {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(process.env.DATABASE_URL),
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log("Syncing job files from disk for all jobs with folders…");
  const result = await syncAllJobFilesFromDisk(prisma);

  if (result.errors.length > 0) {
    console.warn(
      `Sync completed with ${result.errors.length} error(s) (${result.synced} synced, ${result.skipped} skipped).`,
    );
    for (const entry of result.errors) {
      console.warn(`  Job ${entry.jobId}: ${entry.message}`);
    }
  } else {
    console.log(
      `Sync complete for ${result.synced} job folder(s)${result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}.`,
    );
  }

  const count = await prisma.jobFile.count();
  console.log(`Sync complete. ${count} file record(s) in JobFile.`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
