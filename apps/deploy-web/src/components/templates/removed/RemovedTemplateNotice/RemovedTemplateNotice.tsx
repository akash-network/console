import type { FC } from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { PackageX } from "lucide-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export interface RemovedTemplateNoticeProps {
  title: string | undefined;
  isSignedIn: boolean;
}

export const RemovedTemplateNotice: FC<RemovedTemplateNoticeProps> = ({ title, isSignedIn }) => (
  <section aria-labelledby="removed-template-heading" className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-16 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
      <PackageX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
    </span>
    <h1 id="removed-template-heading" className="text-2xl font-bold tracking-tight">
      This template was removed
    </h1>
    {title && <p className="max-w-full break-words text-[15px] font-medium">{title}</p>}
    <p className="text-sm text-muted-foreground">
      It can no longer be opened or deployed. Deployments already made from it keep running, and copies of it are not affected.
    </p>
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
      <Link href={UrlService.templates()} className={cn(buttonVariants({ size: "sm" }))}>
        Browse templates
      </Link>
      {isSignedIn && (
        <Link href={UrlService.myTemplates()} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          My templates
        </Link>
      )}
    </div>
  </section>
);
