import type { FC } from "react";
import { ArrowUpRight, Globe } from "lucide-react";

import { PUBLISHER_LINK_REL, readPublisherLink } from "@src/components/templates/publisher/publisherLinks";
import type { TemplatePublisherLink } from "@src/types/marketplace-template";

export const PublisherLinkList: FC<{ links: TemplatePublisherLink[] }> = ({ links }) => {
  if (links.length === 0) return null;

  return (
    <ul aria-label="Links" className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5">
      {links.map((link, index) => (
        <li key={`${index}:${link.url}`} className="min-w-0 max-w-full">
          <PublisherLinkItem link={link} />
        </li>
      ))}
    </ul>
  );
};

const PublisherLinkItem: FC<{ link: TemplatePublisherLink }> = ({ link }) => {
  const shown = readPublisherLink(link);
  const content = (
    <>
      <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 truncate">{shown.text}</span>
      {shown.host && <span className="min-w-0 truncate text-muted-foreground">· {shown.host}</span>}
    </>
  );

  if (!shown.href) return <span className="inline-flex max-w-full items-center gap-1.5 text-[13px]">{content}</span>;

  return (
    <a
      href={shown.href}
      target="_blank"
      rel={PUBLISHER_LINK_REL}
      className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-[13px] font-medium text-foreground !no-underline underline-offset-2 hover:!underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
      <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
};
