"use client";

import type { FC, MouseEvent } from "react";
import { useId } from "react";
import { Avatar, AvatarFallback, AvatarImage, buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowLeft, ArrowRight, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useHasInAppHistory } from "@src/hooks/useHasInAppHistory";
import type { ApiTemplate } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { TemplateDeploysAs } from "./TemplateDeploysAs/TemplateDeploysAs";
import { TemplateDocuments } from "./TemplateDocuments/TemplateDocuments";

const OVERLINE_CLASSES = "font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";

export const DEPENDENCIES = {
  useRouter,
  useHasInAppHistory,
  Layout,
  TemplateDocuments,
  TemplateDeploysAs
};

export interface TemplateDetailProps {
  template: ApiTemplate;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplateDetail: FC<TemplateDetailProps> = ({ template, dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const hasInAppHistory = d.useHasInAppHistory();
  const beforeYouDeployId = useId();

  const returnToPreviousPage = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!hasInAppHistory || isOpeningElsewhere(event)) return;
    event.preventDefault();
    router.back();
  };

  return (
    <d.Layout background="dots" disableContainer>
      <div className="container px-4 pb-16 pt-6 sm:px-6">
        <Link
          href={UrlService.templates()}
          onClick={returnToPreviousPage}
          className="mb-[18px] inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-[13px] w-[13px]" aria-hidden="true" />
          Back to templates
        </Link>

        <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-border pb-[22px]">
          <div className="min-w-[min(280px,100%)] flex-1">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-[34px] w-[34px] shrink-0 rounded-[9px] border border-border bg-muted">
                <AvatarImage src={template.logoUrl} alt="" className="object-contain p-1" />
                <AvatarFallback className="rounded-[9px] bg-muted">
                  <LayoutTemplate className="h-[17px] w-[17px]" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
              <h1 className="min-w-0 break-words text-[26px] font-bold leading-tight tracking-tight">{template.name}</h1>
            </div>
          </div>

          <Link
            href={UrlService.configureDeployment({ templateId: template.id })}
            className={cn(buttonVariants(), "shrink-0 gap-2 rounded-[10px] font-semibold")}
          >
            Deploy template
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>

        <div className="mt-[22px] grid items-start gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_300px]">
          <d.TemplateDocuments template={template} showsSdl className="-mx-4 sm:mx-0" />

          <aside className="flex min-w-0 flex-col gap-3.5">
            <d.TemplateDeploysAs sdl={template.deploy} />

            <section aria-labelledby={beforeYouDeployId} className="rounded-[14px] border border-border bg-card px-4 py-3.5 shadow-sm">
              <h2 id={beforeYouDeployId} className={cn(OVERLINE_CLASSES, "pb-2")}>
                Before you deploy
              </h2>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Deploy template opens Configure with this template&apos;s image, ports and hardware filled in. You can change them there, and nothing runs until
                you pick a provider and deploy.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </d.Layout>
  );
};

/** Modifier clicks ask the browser to open the gallery in a new tab or window, which going back in this one would override. */
function isOpeningElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
