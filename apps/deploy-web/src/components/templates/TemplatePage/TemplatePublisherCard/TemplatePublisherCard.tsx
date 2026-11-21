import type { FC } from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import Link from "next/link";

import { PublisherLink } from "@src/components/templates/communityGallery/PublisherLink/PublisherLink";
import { pluralize } from "@src/components/templates/communityGallery/usageNumbers";
import type { MarketplaceTemplate } from "@src/types/marketplace-template";
import { UrlService } from "@src/utils/urlUtils";

const OVERLINE_CLASSES = "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

export interface TemplatePublisherCardProps {
  publisher: NonNullable<MarketplaceTemplate["publisher"]>;
  publishedAt: string | null;
  /** A visitor reads only the current version, so its number is the one fact about versions every viewer can be shown. */
  currentVersion: number | undefined;
}

export const TemplatePublisherCard: FC<TemplatePublisherCardProps> = ({ publisher, publishedAt, currentVersion }) => {
  const counts = [pluralize(publisher.counts.templates, "template"), publisher.counts.deploys > 0 && pluralize(publisher.counts.deploys, "deploy")].filter(
    part => !!part
  );

  return (
    <aside aria-label="Publisher" className="flex flex-col gap-3 rounded-[14px] border border-border bg-card px-5 py-4 shadow-sm">
      <p className={OVERLINE_CLASSES}>Publisher</p>
      <div className="flex flex-col gap-1">
        <PublisherLink publisher={publisher} className="text-[15px]" />
        <p className="text-[12.5px] text-muted-foreground">{counts.join(" · ")}</p>
        {publisher.memberSince && <p className="text-[12.5px] text-muted-foreground">Member since {format(new Date(publisher.memberSince), "MMM yyyy")}</p>}
      </div>
      {publisher.handle && (
        <Link href={UrlService.templatePublisher(publisher.handle)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
          View publisher
        </Link>
      )}
      {(publishedAt || currentVersion !== undefined) && (
        <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-[12.5px]">
          {publishedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Published</dt>
              <dd className="font-medium">{format(new Date(publishedAt), "MMM d, yyyy")}</dd>
            </div>
          )}
          {currentVersion !== undefined && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Current version</dt>
              <dd className="font-mono font-medium">v{currentVersion}</dd>
            </div>
          )}
        </dl>
      )}
    </aside>
  );
};
