import type { TemplatePublisherLink } from "@src/types/marketplace-template";

const LINKABLE_PROTOCOLS = ["http:", "https:"];

export const PUBLISHER_LINK_REL = "noopener noreferrer nofollow ugc";

export interface ShownPublisherLink {
  /** Null for anything but an http or https address, which is then shown as text and never linked. */
  href: string | null;
  text: string;
  /** The host the link really opens, shown beside a label so the label cannot pass for another site. */
  host: string | null;
}

export function readPublisherLink(link: TemplatePublisherLink): ShownPublisherLink {
  const url = parseWebAddress(link.url);
  const label = link.label?.trim() || null;

  if (!url) return { href: null, text: label ?? link.url, host: label ? link.url : null };

  return { href: url.href, text: label ?? `${url.host}${withoutTrailingSlash(url.pathname)}`, host: label ? url.host : null };
}

function parseWebAddress(value: string): URL | null {
  const url = parseUrl(value);
  return url && LINKABLE_PROTOCOLS.includes(url.protocol) ? url : null;
}

/** Safari before 17 has no `URL.canParse`, so a refused address is caught instead. */
export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function withoutTrailingSlash(path: string): string {
  return path.replace(/\/+$/, "");
}
