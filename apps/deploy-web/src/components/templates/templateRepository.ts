/** The repository path a template's source link points at, such as `akash-network/awesome-akash/comfyui`; undefined for a link that names no repository. */
export function describeRepository(url: string | undefined): string | undefined {
  if (!url) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  const [owner, repo, view, , ...path] = parsed.pathname.split("/").filter(Boolean);
  if (!owner || !repo) return undefined;

  const isFileView = view === "blob" || view === "tree";
  return [owner, repo, ...(isFileView ? path : [])].join("/");
}
