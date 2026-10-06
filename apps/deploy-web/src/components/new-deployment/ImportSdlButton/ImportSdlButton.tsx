"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import type { ImportedDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import type { ImportMeta } from "@src/components/deployments/ConfigureDeployment/SdlImportExport/ImportSdlDialog";
import { ImportSdlDialog } from "@src/components/deployments/ConfigureDeployment/SdlImportExport/ImportSdlDialog";
import { createConfigureDraft } from "@src/components/deployments/ConfigureDeployment/useConfigureDraft/useConfigureDraft";
import { useServices } from "@src/context/ServicesProvider";
import { helloWorldTemplate } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { useRouter, ImportSdlDialog, createConfigureDraft };

type Props = { dependencies?: typeof DEPENDENCIES };

export const ImportSdlButton: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const router = d.useRouter();
  const [isImportOpen, setImportOpen] = useState(false);

  function openImportedSdlInConfigure(state: ImportedDeploymentState, meta: ImportMeta) {
    setImportOpen(false);
    analyticsService.track("sdl_uploaded", { category: "deployments", method: meta.method }, "Amplitude");
    router.push(UrlService.configureDeployment({ draftId: d.createConfigureDraft(state.sdl) }));
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)} className="shrink-0 gap-1.5">
        <UploadIcon className="h-4 w-4" aria-hidden="true" />
        Import SDL
      </Button>

      {isImportOpen && <d.ImportSdlDialog onClose={() => setImportOpen(false)} onImport={openImportedSdlInConfigure} exampleSdl={helloWorldTemplate.content} />}
    </>
  );
};
