"use client";
import { type ComponentPropsWithoutRef, type FC, type ReactNode, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { ReactMarkdownProps } from "react-markdown/lib/ast-to-react";
import Link from "next/link";
import remarkGfm from "remark-gfm";

import { rehypeOpenLinksWithoutOpener } from "@src/components/shared/rehypeOpenLinksWithoutOpener/rehypeOpenLinksWithoutOpener";

export const DEPENDENCIES: { Link: (props: { href: string; children: ReactNode }) => ReactNode } = { Link };

/** Images would load whatever URL an answer names, which logs or SDL the assistant read could have planted, so they never render. */
const DISALLOWED_ELEMENTS = ["img"];

/** Answers are model output, so only an exact match on one of these Console routes navigates in place. */
const IN_APP_ROUTES = [/^\/deployments(?:\/\d+)?$/, /^\/templates(?:\/[\w-]+)?$/, /^\/(?:alerts|billing|usage)$/];

/** Link text in an answer is model output, so only these domains and their subdomains render as links; any other URL is shown in full. */
const LINKABLE_DOMAINS = ["akash.network", "discord.com", "discord.gg"];

const LINKABLE_GITHUB_PATH = /^\/akash-network(?:\/|$)/i;

function isInAppRoute(href: string | undefined): href is string {
  return href !== undefined && IN_APP_ROUTES.some(route => route.test(href));
}

function isLinkableExternalHref(href: string | undefined): boolean {
  const url = parseUrl(href);
  if (url?.protocol !== "https:") return false;
  if (url.hostname === "github.com") return LINKABLE_GITHUB_PATH.test(url.pathname);

  return LINKABLE_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
}

function parseUrl(href: string | undefined): URL | undefined {
  try {
    return new URL(String(href));
  } catch {
    return undefined;
  }
}

type LinkProps = ComponentPropsWithoutRef<"a"> & ReactMarkdownProps;

function isLabelledByItsHref(node: LinkProps["node"], href: string | undefined): boolean {
  return node.children.map(child => ("value" in child ? child.value : "")).join("") === href;
}

function createAssistantLink(InAppLink: typeof DEPENDENCIES.Link): FC<LinkProps> {
  return function AssistantLink({ node, href, children, ...newTabProps }) {
    if (isInAppRoute(href)) {
      return <InAppLink href={href}>{children}</InAppLink>;
    }

    if (isLinkableExternalHref(href)) {
      return (
        <a href={href} {...newTabProps}>
          {children}
        </a>
      );
    }

    return (
      <span className="[overflow-wrap:anywhere]">
        {children}
        {!isLabelledByItsHref(node, href) && ` (${href})`}
      </span>
    );
  };
}

/** Answers are model output, so raw HTML is never rendered and every link outside Console opens without a handle back to it. */
export const AssistantMarkdown: FC<{ children: string; dependencies?: typeof DEPENDENCIES }> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const components = useMemo(() => ({ a: createAssistantLink(d.Link) }), [d.Link]);

  return (
    <ReactMarkdown
      className="prose prose-sm max-w-full break-words dark:prose-invert prose-p:my-1.5 prose-code:before:hidden prose-code:after:hidden prose-pre:my-2 prose-pre:bg-muted prose-pre:text-foreground prose-ol:my-1.5 prose-ul:my-1.5"
      skipHtml
      linkTarget="_blank"
      disallowedElements={DISALLOWED_ELEMENTS}
      unwrapDisallowed
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeOpenLinksWithoutOpener]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
};
