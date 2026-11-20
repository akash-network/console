import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";

import { PublisherName } from "@src/components/templates/communityGallery/PublisherName/PublisherName";
import { UrlService } from "@src/utils/urlUtils";

export interface LinkedPublisher {
  name: string;
  /** Null while the publisher has no page: Akash for an awesome-akash template, an organization that has yet to publish. */
  handle: string | null;
  verified: boolean;
}

export const PublisherLink: FC<{ publisher: LinkedPublisher; className?: string }> = ({ publisher, className }) =>
  publisher.handle ? (
    <Link
      href={UrlService.templatePublisher(publisher.handle)}
      prefetch={false}
      className={cn(
        "inline-flex min-w-0 rounded-sm !no-underline underline-offset-2 hover:!underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <PublisherName name={publisher.name} verified={publisher.verified} />
    </Link>
  ) : (
    <PublisherName name={publisher.name} verified={publisher.verified} className={className} />
  );
