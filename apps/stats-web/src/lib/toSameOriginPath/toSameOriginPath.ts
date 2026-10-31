/** A pathname starting with "//" never counts as same-origin, because resolving it again reads it as another host. */
export function toSameOriginPath(value: string, origin: string): string | undefined {
  const url = new URL(value, origin);

  if (url.origin !== new URL(origin).origin || url.pathname.startsWith("//")) return undefined;

  return `${url.pathname}${url.search}${url.hash}`;
}
