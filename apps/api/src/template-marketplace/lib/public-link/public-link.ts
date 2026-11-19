import { isIP } from "node:net";

export const MAX_PUBLIC_LINK_LENGTH = 200;

export type PublicLink = { href: string } | { issue: string };

/** Names that resolve inside a network or nowhere, which a link shown to strangers must not point at. */
const NON_PUBLIC_TOP_LEVEL_DOMAINS: readonly string[] = [
  "local",
  "localhost",
  "localdomain",
  "internal",
  "intranet",
  "private",
  "corp",
  "home",
  "lan",
  "arpa",
  "test",
  "example",
  "invalid",
  "onion"
];

const TOO_LONG_ISSUE = `The link is longer than ${MAX_PUBLIC_LINK_LENGTH} characters`;

const HOST_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const TOP_LEVEL_DOMAIN = /^([a-z]{2,}|xn--[a-z0-9-]+)$/;

function isPublicHostName(hostname: string): boolean {
  const labels = hostname.split(".");
  const topLevelDomain = labels[labels.length - 1];

  return (
    labels.length > 1 &&
    labels.every(label => HOST_LABEL.test(label)) &&
    TOP_LEVEL_DOMAIN.test(topLevelDomain) &&
    !NON_PUBLIC_TOP_LEVEL_DOMAINS.includes(topLevelDomain)
  );
}

function findIssue(url: URL): string | undefined {
  if (url.protocol !== "https:") return "The link must start with https://";
  if (url.username || url.password) return "The link cannot carry a username or a password";
  if (url.port) return "The link cannot name a port";
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0) return "The link must name a website, not an address";
  if (!isPublicHostName(url.hostname)) return "The link must name a public website";

  return undefined;
}

/** Answers the link as the URL parser reads it, so what is stored and shown is exactly what was checked. */
export function parsePublicLink(value: string): PublicLink {
  if (value.length > MAX_PUBLIC_LINK_LENGTH) return { issue: TOO_LONG_ISSUE };
  if (!URL.canParse(value)) return { issue: "The link is not a URL" };

  const url = new URL(value);
  const issue = url.href.length > MAX_PUBLIC_LINK_LENGTH ? TOO_LONG_ISSUE : findIssue(url);

  return issue ? { issue } : { href: url.href };
}
