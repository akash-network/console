export type Primitive = string | number | boolean;
export type QueryValue = Primitive | Primitive[] | null | undefined;

export function buildUrl(
  baseUrl: string,
  path: string,
  pathParams: Record<string, Primitive> | undefined,
  query: Record<string, QueryValue> | undefined
): string {
  let url = path.replace(/\{([^{}]+)\}/g, (_, key: string) => {
    const value = pathParams?.[key];
    if (value === undefined || value === null) {
      throw new Error(`missing path param: ${key}`);
    }
    return encodeURIComponent(String(value));
  });

  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) qs.append(k, String(item));
      } else {
        qs.append(k, String(v));
      }
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const base = baseUrl.replace(/\/$/, "");
  return base + url;
}
