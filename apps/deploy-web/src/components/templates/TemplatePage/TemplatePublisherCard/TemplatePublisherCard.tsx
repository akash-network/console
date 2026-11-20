import type { FC } from "react";
import { format } from "date-fns";

import { PublisherName } from "@src/components/templates/communityGallery/PublisherName/PublisherName";
import { pluralize } from "@src/components/templates/communityGallery/usageNumbers";
import type { MarketplaceTemplate } from "@src/types/marketplace-template";

const OVERLINE_CLASSES = "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

export interface TemplatePublisherCardProps {
  publisher: NonNullable<MarketplaceTemplate["publisher"]>;
  publishedAt: string | null;
  /** Undefined until the versions load. */
  versionCount: number | undefined;
}

export const TemplatePublisherCard: FC<TemplatePublisherCardProps> = ({ publisher, publishedAt, versionCount }) => {
  const counts = [pluralize(publisher.counts.templates, "template"), publisher.counts.deploys > 0 && pluralize(publisher.counts.deploys, "deploy")].filter(
    part => !!part
  );

  return (
    <aside aria-label="Publisher" className="flex flex-col gap-3 rounded-[14px] border border-border bg-card px-5 py-4 shadow-sm">
      <p className={OVERLINE_CLASSES}>Publisher</p>
      <div className="flex flex-col gap-1">
        <PublisherName name={publisher.name} verified={publisher.verified} className="text-[15px]" />
        <p className="text-[12.5px] text-muted-foreground">{counts.join(" · ")}</p>
        {publisher.memberSince && <p className="text-[12.5px] text-muted-foreground">Member since {format(new Date(publisher.memberSince), "MMM yyyy")}</p>}
      </div>
      {(publishedAt || versionCount !== undefined) && (
        <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-[12.5px]">
          {publishedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Published</dt>
              <dd className="font-medium">{format(new Date(publishedAt), "MMM d, yyyy")}</dd>
            </div>
          )}
          {versionCount !== undefined && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Versions</dt>
              <dd className="font-medium">{versionCount}</dd>
            </div>
          )}
        </dl>
      )}
    </aside>
  );
};
