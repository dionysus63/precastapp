import path from "path";

function normalizePath(value: string) {
  return path.normalize(value.trim());
}

function pathsEqual(left: string, right: string) {
  if (process.platform === "win32") {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

function pathStartsWith(parent: string, child: string) {
  if (process.platform === "win32") {
    return child.toLowerCase().startsWith(parent.toLowerCase());
  }
  return child.startsWith(parent);
}

export function assertPathUnderRoot(root: string, targetPath: string) {
  const resolvedRoot = path.resolve(normalizePath(root));
  const resolved = path.resolve(normalizePath(targetPath));
  const rootWithSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  if (!pathsEqual(resolved, resolvedRoot) && !pathStartsWith(rootWithSep, resolved)) {
    throw new Error(`Refusing to open path outside of ${resolvedRoot}: ${resolved}`);
  }
}

export function assertPathUnderJobsRoot(jobsRoot: string, targetPath: string) {
  assertPathUnderRoot(jobsRoot, targetPath);
}

export function assertPathUnderJobFolder(
  jobFolderPath: string,
  targetPath: string,
) {
  const root = path.resolve(normalizePath(jobFolderPath));
  const resolved = path.resolve(normalizePath(targetPath));
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!pathsEqual(resolved, root) && !pathStartsWith(rootWithSep, resolved)) {
    throw new Error("Path is outside the job folder.");
  }
}
