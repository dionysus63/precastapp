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
  await syncAllJobFilesFromDisk(prisma);

  const count = await prisma.jobFile.count();
  console.log(`Sync complete. ${count} file record(s) in JobFile.`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
