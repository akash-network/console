interface ImageSource {
  hostname: string;
  pathname?: RegExp;
}

/** A viewer's browser requests every listed source, so each must be run by a party the author is not: never list a host that redirects or serves from an address the author picks. */
export const USER_CONTENT_IMAGE_SOURCES: readonly ImageSource[] = [
  { hostname: "raw.githubusercontent.com" },
  { hostname: "user-images.githubusercontent.com" },
  { hostname: "avatars.githubusercontent.com" },
  { hostname: "camo.githubusercontent.com" },
  { hostname: "github.com", pathname: /^\/(?:user-attachments\/assets|[^/]+\/[^/]+\/(?:raw|blob|assets))\// },
  { hostname: "img.shields.io" }
];

export function toLoadableUserContentImageUrl(src: unknown): string | undefined {
  const url = parseAbsoluteUrl(src);
  if (!url || url.protocol !== "https:" || url.username || url.password || url.port) return undefined;

  const isListed = USER_CONTENT_IMAGE_SOURCES.some(source => source.hostname === url.hostname && (!source.pathname || source.pathname.test(url.pathname)));

  return isListed ? url.href : undefined;
}

export function parseAbsoluteUrl(value: unknown): URL | undefined {
  if (typeof value !== "string") return undefined;

  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
