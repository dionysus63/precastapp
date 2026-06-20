import "dotenv/config";
import path from "path";
import type { ExplorerLaunchMethod } from "@/lib/windows-explorer";
import {
  launchWindowsFile,
  launchWindowsFolder,
} from "@/lib/windows-explorer";

function parseArgs(argv: string[]) {
  const verbose = argv.includes("--verbose");
  const target = argv.find((arg) => arg !== "--verbose")?.trim();

  return { verbose, target };
}

async function main() {
  const { verbose, target } = parseArgs(process.argv.slice(2));

  if (!target) {
    console.error(
      'Usage: npx tsx scripts/test-explorer-open.ts [--verbose] "C:\\PrecastJobs\\..."',
    );
    process.exit(1);
  }

  if (process.platform !== "win32") {
    console.error("This script only runs on Windows.");
    process.exit(1);
  }

  const { stat } = await import("fs/promises");
  let kind: "folder" | "file";

  try {
    const fileStat = await stat(target);
    kind = fileStat.isDirectory() ? "folder" : "file";
  } catch {
    kind = path.extname(target) ? "file" : "folder";
  }

  let launchMethod: ExplorerLaunchMethod | undefined;

  console.log(`Opening ${kind}: ${target}`);

  const launchOptions = {
    onLaunchMethod(method: ExplorerLaunchMethod) {
      launchMethod = method;
    },
    onLaunchAttempt(
      method: ExplorerLaunchMethod,
      result: "ok" | "failed",
      error?: Error,
    ) {
      if (!verbose) {
        return;
      }

      if (result === "ok") {
        console.log(`[verbose] ${method}: ok`);
        return;
      }

      console.log(
        `[verbose] ${method}: failed${error ? ` (${error.message})` : ""}`,
      );
    },
  };

  if (kind === "folder") {
    await launchWindowsFolder(target, launchOptions);
  } else {
    await launchWindowsFile(target, launchOptions);
  }

  console.log(
    `Explorer launch completed via ${launchMethod ?? "unknown method"}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
