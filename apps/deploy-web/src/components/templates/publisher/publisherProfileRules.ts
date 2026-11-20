import type { CurrentTemplatePublisher, TemplatePublisherProfileChange } from "@src/types/marketplace-template";

export const MAX_PUBLISHER_BIO_LENGTH = 300;
export const MAX_PUBLISHER_LINKS = 3;
export const MAX_PUBLISHER_LINK_URL_LENGTH = 200;
export const MAX_PUBLISHER_LINK_LABEL_LENGTH = 40;

export interface PublisherLinkDraft {
  url: string;
  label: string;
}

export interface PublisherProfileDraft {
  bio: string;
  links: PublisherLinkDraft[];
}

export interface PublisherProfileIssues {
  bio: string | undefined;
  links: { url: string | undefined; label: string | undefined }[];
}

/** The API refuses a link to any of these, which resolve inside a network or nowhere. */
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

const TOO_LONG_LINK_ISSUE = `The link is longer than ${MAX_PUBLISHER_LINK_URL_LENGTH} characters`;
const HOST_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const TOP_LEVEL_DOMAIN = /^([a-z]{2,}|xn--[a-z0-9-]+)$/;
const IPV4_ADDRESS = /^\d+(\.\d+){3}$/;

export function toPublisherProfileDraft(profile: Pick<CurrentTemplatePublisher, "bio" | "links">): PublisherProfileDraft {
  return { bio: profile.bio ?? "", links: profile.links.map(link => ({ url: link.url, label: link.label ?? "" })) };
}

export function findPublisherProfileIssues(draft: PublisherProfileDraft): PublisherProfileIssues {
  return {
    bio: draft.bio.trim().length > MAX_PUBLISHER_BIO_LENGTH ? `The bio is longer than ${MAX_PUBLISHER_BIO_LENGTH} characters` : undefined,
    links: draft.links.map(link =>
      isBlankLink(link) ? { url: undefined, label: undefined } : { url: findLinkIssue(link.url), label: findLabelIssue(link.label) }
    )
  };
}

export function hasPublisherProfileIssues(issues: PublisherProfileIssues): boolean {
  return !!issues.bio || issues.links.some(link => !!link.url || !!link.label);
}

/** A row left empty is not a link, so it is dropped instead of being refused. */
export function toPublisherProfileChange(draft: PublisherProfileDraft): Required<TemplatePublisherProfileChange> {
  return {
    bio: draft.bio.trim() || null,
    links: draft.links.filter(link => !isBlankLink(link)).map(link => ({ url: link.url.trim(), label: link.label.trim() || null }))
  };
}

function isBlankLink(link: PublisherLinkDraft): boolean {
  return !link.url.trim() && !link.label.trim();
}

function findLabelIssue(value: string): string | undefined {
  return value.trim().length > MAX_PUBLISHER_LINK_LABEL_LENGTH ? `The label is longer than ${MAX_PUBLISHER_LINK_LABEL_LENGTH} characters` : undefined;
}

/** Follows the API's own checks in their order and wording, so a link refused here is refused there for the same reason. */
function findLinkIssue(value: string): string | undefined {
  const address = value.trim();
  if (!address) return "Add the link's address, or clear its label";
  if (address.length > MAX_PUBLISHER_LINK_URL_LENGTH) return TOO_LONG_LINK_ISSUE;
  if (!URL.canParse(address)) return "The link is not a URL";

  const url = new URL(address);
  if (url.href.length > MAX_PUBLISHER_LINK_URL_LENGTH) return TOO_LONG_LINK_ISSUE;
  if (url.protocol !== "https:") return "The link must start with https://";
  if (url.username || url.password) return "The link cannot carry a username or a password";
  if (url.port) return "The link cannot name a port";
  if (url.hostname.startsWith("[") || IPV4_ADDRESS.test(url.hostname)) return "The link must name a website, not an address";
  if (!isPublicHostName(url.hostname)) return "The link must name a public website";

  return undefined;
}

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
