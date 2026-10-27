"use client";
import type { FC } from "react";
import { useId } from "react";
import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { Avatar, AvatarFallback, AvatarImage } from "@akashnetwork/ui/components";
import { ArrowRight, LayoutTemplate } from "lucide-react";
import Link from "next/link";

import { TemplateDeploysAs } from "@src/components/templates/TemplateDeploysAs/TemplateDeploysAs";
import { TemplateDocuments } from "@src/components/templates/TemplateDocuments/TemplateDocuments";
import { UrlService } from "@src/utils/urlUtils";
import { EDGE_TO_EDGE_ON_PHONES } from "../pageBand";

export const DEPENDENCIES = { TemplateDocuments, TemplateDeploysAs };

export interface DeploymentTemplateGuideProps {
  template: TemplateOutput;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentTemplateGuide: FC<DeploymentTemplateGuideProps> = ({ template, dependencies: d = DEPENDENCIES }) => {
  const templateNameId = useId();

  return (
    <div className="grid items-start gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_300px]">
      <d.TemplateDocuments template={template} className={EDGE_TO_EDGE_ON_PHONES} />

      <aside className="flex min-w-0 flex-col gap-3.5">
        <section aria-labelledby={templateNameId} className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="h-[34px] w-[34px] shrink-0 rounded-[9px] border border-border bg-muted">
              <AvatarImage src={template.logoUrl} alt="" className="object-contain p-1" />
              <AvatarFallback className="rounded-[9px] bg-muted">
                <LayoutTemplate className="h-[17px] w-[17px]" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            <h2 id={templateNameId} className="min-w-0 break-words text-sm font-semibold">
              {template.name}
            </h2>
          </div>
          <Link
            href={UrlService.templateDetails(template.id)}
            className="inline-flex items-center gap-1 self-start text-[12.5px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            View template
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </section>

        <d.TemplateDeploysAs sdl={template.deploy} title="Template defaults" note="This deployment's own configuration is on the Details tab." />
      </aside>
    </div>
  );
};
