"use client";
import type { FC } from "react";
import { FileButton, Snackbar } from "@akashnetwork/ui/components";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import { createConfigureDraft } from "@src/components/deployments/ConfigureDeployment/useConfigureDraft/useConfigureDraft";
import { useServices } from "@src/context/ServicesProvider";
import { UrlService } from "@src/utils/urlUtils";

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { useRouter, useSnackbar, Snackbar, FileButton, importDeploymentState, createConfigureDraft };

type Props = { dependencies?: typeof DEPENDENCIES };

export const UploadSdlButton: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const router = d.useRouter();
  const { enqueueSnackbar } = d.useSnackbar();

  const openUploadedSdlInConfigure = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function routeValidSdlToConfigure(event) {
      const content = event.target?.result as string;

      if (!canImportSdl(content, d.importDeploymentState)) {
        enqueueSnackbar(
          <d.Snackbar title="Invalid SDL file" subTitle="This file couldn't be read as a deployment. Please upload a valid SDL." iconVariant="error" />,
          { variant: "error" }
        );
        return;
      }

      analyticsService.track("sdl_uploaded", "Amplitude");
      router.push(UrlService.configureDeployment({ draftId: d.createConfigureDraft(content) }));
    };

    reader.readAsText(file);
  };

  return (
    <d.FileButton onFileSelect={openUploadedSdlInConfigure} accept=".yml,.yaml,.txt" variant="outline" size="sm" className="shrink-0 gap-1.5">
      <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
      Upload SDL
    </d.FileButton>
  );
};

/** Configure falls back to an empty deployment for any SDL its importer refuses, including one without a service, so the same importer gates the upload. */
function canImportSdl(sdl: string, importSdl: typeof importDeploymentState): boolean {
  try {
    importSdl(sdl);
    return true;
  } catch {
    return false;
  }
}
