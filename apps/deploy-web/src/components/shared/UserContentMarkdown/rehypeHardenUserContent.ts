import { parseAbsoluteUrl, toLoadableUserContentImageUrl } from "./userContentImageSources";

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const LINK_PROTOCOLS = ["http:", "https:", "mailto:"];

export const USER_CONTENT_LINK_REL = ["ugc", "nofollow", "noopener", "noreferrer"];

export const LEAVES_CONSOLE_MARK = " ↗";

const DIRECTION_OVERRIDES = /[\u202a-\u202e\u2066-\u2069]/g;

const INVISIBLE_CHARACTERS = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu;

const DOT_LOOKALIKES = /[\u00b7\u06d4\u16eb\u2022\u2027\u2219\u22c5\u30fb\u3002\ua4fe\ua60d\uff61]/g;

/** Host matching backtracks over every dotted run, so a label too long to be a readable address is not searched at all. */
const MAX_SEARCHED_LABEL_LENGTH = 2000;

const MAILBOX_NAMES = /[^\s@]+@/g;

const HOST_NAME = /(?:[\p{L}\p{N}_-]+\.)+\p{L}[\p{L}\p{N}-]+/u;

const IPV4_ADDRESS = /(?<![\p{L}\p{N}_.-])(?:\d{1,3}\.){3}\d{1,3}(?![\p{L}\p{N}_-])/u;

const IPV6_ADDRESS = /(?<![\p{L}\p{N}_:])(?:(?:[0-9a-f]{1,4}:){2,}[0-9a-f:]*|::(?:[0-9a-f]{1,4}:)*[0-9a-f]{1,4})(?![\p{L}\p{N}_])/iu;

const LOCAL_HOST = /\blocalhost\b/iu;

const ADDRESS_LIKE_WORDS = new RegExp([HOST_NAME, IPV4_ADDRESS, IPV6_ADDRESS, LOCAL_HOST].map(({ source }) => source).join("|"), "giu");

/** Content one user writes for others: links only leave Console and say where to, and images load only from listed sources. */
export function rehypeHardenUserContent() {
  return function hardenUserContent(tree: HastNode) {
    tree.children = hardenAll(tree.children ?? [], false);
  };
}

function hardenAll(nodes: HastNode[], isInsideLink: boolean): HastNode[] {
  return nodes.flatMap(node => harden(node, isInsideLink));
}

function harden(node: HastNode, isInsideLink: boolean): HastNode[] {
  if (node.value !== undefined) return [{ ...node, value: withoutDirectionOverrides(node.value) }];
  if (node.tagName === "img") return hardenImage(node, isInsideLink);
  if (node.tagName === "a" && !isInsideLink) return hardenLink(node);

  const children = hardenAll(node.children ?? [], isInsideLink);

  return node.tagName === "a" ? children : [{ ...node, children }];
}

function hardenImage(image: HastNode, isInsideLink: boolean): HastNode[] {
  const alt = withoutDirectionOverrides(String(image.properties?.alt ?? ""));
  const loadableUrl = toLoadableUserContentImageUrl(image.properties?.src);

  if (loadableUrl) {
    return [{ type: "element", tagName: "img", properties: { src: loadableUrl, alt, loading: "lazy", referrerPolicy: "no-referrer" }, children: [] }];
  }

  const imageUrl = isInsideLink ? undefined : toLinkUrl(image.properties?.src);
  if (imageUrl) return hardenLink(anchorTo(imageUrl, [text(alt || imageUrl.href)]));

  return alt ? [text(alt)] : [];
}

function hardenLink(link: HastNode): HastNode[] {
  const label = hardenAll(link.children ?? [], true);
  const url = toLinkUrl(link.properties?.href);

  if (!url || label.some(containsImage)) return label;

  if (namesAnotherDestination(textOf(label), url)) {
    return [...label, text(" ("), anchorTo(url, [text(url.href), leavesConsoleMark()]), text(")")];
  }

  return [anchorTo(url, [...label, leavesConsoleMark()])];
}

function toLinkUrl(href: unknown): URL | undefined {
  const url = parseAbsoluteUrl(href);

  return url && LINK_PROTOCOLS.includes(url.protocol) && !url.username && !url.password ? url : undefined;
}

function anchorTo(url: URL, children: HastNode[]): HastNode {
  return { type: "element", tagName: "a", properties: { href: url.href, target: "_blank", rel: [...USER_CONTENT_LINK_REL] }, children };
}

function leavesConsoleMark(): HastNode {
  return { type: "element", tagName: "span", properties: { ariaHidden: "true" }, children: [text(LEAVES_CONSOLE_MARK)] };
}

function text(value: string): HastNode {
  return { type: "text", value };
}

function containsImage(node: HastNode): boolean {
  return node.tagName === "img" || (node.children ?? []).some(containsImage);
}

function textOf(nodes: HastNode[]): string {
  return nodes.map(node => node.value ?? textOf(node.children ?? [])).join("");
}

/** A label that reads as a web address is a promise about where the link goes, and an internationalized host can imitate any other. */
function namesAnotherDestination(label: string, url: URL): boolean {
  if (label === url.href) return false;
  if (url.hostname.includes("xn--") || label.length > MAX_SEARCHED_LABEL_LENGTH) return true;

  const isEmailLink = url.protocol === "mailto:";
  const readableLabel = label.normalize("NFKC").replace(INVISIBLE_CHARACTERS, "").replace(DOT_LOOKALIKES, ".");
  const namedHosts = ((isEmailLink ? readableLabel.replace(MAILBOX_NAMES, "") : readableLabel).match(ADDRESS_LIKE_WORDS) ?? []).map(toComparableHost);
  const destination = toComparableHost(isEmailLink ? url.pathname.slice(url.pathname.lastIndexOf("@") + 1) : url.hostname);

  return namedHosts.length > 0 ? namedHosts.some(host => host !== destination) : readableLabel.includes("://");
}

function toComparableHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function withoutDirectionOverrides(value: string): string {
  return value.replace(DIRECTION_OVERRIDES, "");
}
