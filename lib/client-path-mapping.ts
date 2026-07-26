import path from "path";
import { getAppSettings } from "@/lib/app-settings";

export type ClientPathMapping = {
  /** Root as the server sees it (e.g. C:\PrecastJobs). */
  serverRoot: string;
  /** Same root as office PCs see it (e.g. \\SERVER\PrecastJobs). */
  clientRoot: string;
};

function stripTrailingSeparators(value: string) {
  return value.replace(/[\\/]+$/, "");
}

/**
 * Rewrites a server-local path to the equivalent client-visible (UNC) path
 * using the first mapping whose server root prefixes it — longest root wins
 * so nested roots translate correctly. Returns the path unchanged when no
 * mapping applies.
 */
export function translateToClientPath(
  targetPath: string,
  mappings: ClientPathMapping[],
): string {
  const normalized = path.win32.normalize(targetPath.trim());
  const candidates = mappings
    .map((mapping) => ({
      serverRoot: stripTrailingSeparators(
        path.win32.normalize(mapping.serverRoot.trim()),
      ),
      clientRoot: stripTrailingSeparators(mapping.clientRoot.trim()),
    }))
    .filter((mapping) => mapping.serverRoot && mapping.clientRoot)
    .sort((a, b) => b.serverRoot.length - a.serverRoot.length);

  const normalizedLower = normalized.toLowerCase();
  for (const { serverRoot, clientRoot } of candidates) {
    const rootLower = serverRoot.toLowerCase();
    if (normalizedLower === rootLower) {
      return clientRoot;
    }
    if (normalizedLower.startsWith(`${rootLower}\\`)) {
      return clientRoot + normalized.slice(serverRoot.length);
    }
  }
  return normalized;
}

/**
 * Mappings from the Files & Folders settings: each storage root paired with
 * its optional client-visible path.
 */
export async function getClientPathMappings(): Promise<ClientPathMapping[]> {
  const settings = await getAppSettings();
  const pairs: Array<[string, string | null]> = [
    [settings.jobsRoot, settings.jobsRootClientPath],
    [settings.quotePdfFallbackDir, settings.quotePdfFallbackDirClientPath],
    [settings.stockSubmittalsRoot, settings.stockSubmittalsRootClientPath],
  ];
  return pairs
    .filter((pair): pair is [string, string] => Boolean(pair[1]))
    .map(([serverRoot, clientRoot]) => ({ serverRoot, clientRoot }));
}

/**
 * Translates a server path for a remote client using the configured
 * settings mappings.
 */
export async function toClientOpenPath(targetPath: string): Promise<string> {
  return translateToClientPath(targetPath, await getClientPathMappings());
}
