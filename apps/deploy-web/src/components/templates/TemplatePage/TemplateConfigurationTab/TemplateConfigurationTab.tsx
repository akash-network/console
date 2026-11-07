"use client";
import type { FC } from "react";
import { useId } from "react";
import { FileCode } from "lucide-react";

import { SDLEditor } from "@src/components/sdl/SDLEditor/SDLEditor";
import { TemplateDeploysAs } from "@src/components/templates/TemplateDeploysAs/TemplateDeploysAs";
import type { TemplateVersionDetail } from "@src/types/marketplace-template";
import { AskedValuesList } from "../AskedValuesList/AskedValuesList";

export const DEPENDENCIES = {
  AskedValuesList,
  SDLEditor,
  TemplateDeploysAs
};

export interface TemplateConfigurationTabProps {
  version: TemplateVersionDetail;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplateConfigurationTab: FC<TemplateConfigurationTabProps> = ({ version, dependencies: d = DEPENDENCIES }) => {
  const sdlHeadingId = useId();

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <d.AskedValuesList askedValues={version.askedValues} />
        <section aria-labelledby={sdlHeadingId} className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
          <h2 id={sdlHeadingId} className="flex items-center gap-1.5 border-b border-border px-5 py-3 font-mono text-xs text-muted-foreground">
            <FileCode className="h-[13px] w-[13px]" aria-hidden="true" />
            deploy.yaml
          </h2>
          <div className="h-[60vh] min-h-[360px] sm:p-3">
            <d.SDLEditor height="100%" value={version.sdl} readonly />
          </div>
        </section>
      </div>
      <d.TemplateDeploysAs sdl={version.sdl} />
    </div>
  );
};
