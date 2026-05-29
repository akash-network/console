import path from "node:path";

/**
 * Resolves `segment` against `baseDir`, returning the absolute path ONLY if it stays
 * strictly inside `baseDir`. Returns null for path traversal, absolute escapes, null
 * bytes, or the base dir itself. Use for any caller-supplied filesystem segment.
 */
export function resolvePathWithinDir(baseDir: string, segment: string): string | null {
  if (segment.includes("\0")) return null;

  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(resolvedBase, segment);
  const relative = path.relative(resolvedBase, resolved);

  if (relative === "" || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    return null;
  }

  return resolved;
}
