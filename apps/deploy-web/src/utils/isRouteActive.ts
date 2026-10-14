/** True when the pathname is one of the prefixes or a sub-route of one. */
export const isRouteActive = (pathname: string | null, ...prefixes: string[]): boolean =>
  !!pathname && prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
