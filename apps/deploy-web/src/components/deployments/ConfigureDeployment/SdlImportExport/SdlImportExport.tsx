"use client";
import type { FC } from "react";
import { useState } from "react";
import {
  Button,
  CustomNoDivTooltip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Snackbar
} from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { saveAs } from "file-saver";
import { DownloadIcon, Settings, UploadIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { helloWorldTemplate } from "@src/utils/templates";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import type { ImportMeta } from "./ImportSdlDialog";
import { ImportSdlDialog } from "./ImportSdlDialog";

/** Narrowed to the single call signature used here so tests can supply a plain stub. */
const saveBlobAs: (data: Blob, filename: string) => void = saveAs;

/** Names the menu trigger for both the visible tooltip and the accessible label, so the two can't drift apart. */
const MENU_TRIGGER_LABEL = "Import or export config";

const EXPORT_TRIGGER_LABEL = "Export SDL";

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { ImportSdlDialog, useServices, useSnackbar, Snackbar, saveAs: saveBlobAs, copyTextToClipboard, CustomNoDivTooltip };

type Props = {
  /** The live SDL — exactly what Deploy would submit — used as the export source. */
  sdl: string;
  /** Names the exported file. */
  deploymentName: string;
  /** False while the flow is locked (quoting/deploying); disables Import only, Export stays available. */
  canImport: boolean;
  onImport: (state: ImportedDeploymentState) => void;
  /** `toolbar` shows a labelled Import SDL button and keeps only the exports in the menu. */
  variant?: "menu" | "toolbar";
  dependencies?: typeof DEPENDENCIES;
};

/** SDL import/export actions for the configure toolbar, collapsed into a single overflow menu. */
export const SdlImportExport: FC<Props> = ({ sdl, deploymentName, canImport, onImport, variant = "menu", dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const [isImportOpen, setImportOpen] = useState(false);

  function handleImported(state: ImportedDeploymentState, meta: ImportMeta) {
    onImport(state);
    analyticsService.track("configure_sdl_imported", { category: "deployments", method: meta.method });
    enqueueSnackbar(<d.Snackbar title="SDL imported" iconVariant="success" />, { variant: "success" });
    setImportOpen(false);
  }

  function handleDownload() {
    d.saveAs(new Blob([sdl], { type: "text/yaml;charset=utf-8" }), sdlFileName(deploymentName));
    analyticsService.track("configure_sdl_downloaded", { category: "deployments" });
  }

  async function handleCopy() {
    const copied = await d.copyTextToClipboard(sdl);
    if (!copied) {
      enqueueSnackbar(<d.Snackbar title="Couldn't copy the SDL to your clipboard" iconVariant="error" />, { variant: "error" });
      return;
    }
    enqueueSnackbar(<d.Snackbar title="SDL copied to clipboard!" iconVariant="success" />, { variant: "success" });
    analyticsService.track("configure_sdl_copied", { category: "deployments" });
  }

  const exportItems = (
    <>
      <DropdownMenuItem disabled={!sdl} onClick={handleDownload}>
        Download .yaml
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!sdl} onClick={handleCopy}>
        Copy to clipboard
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      {variant === "toolbar" ? (
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" disabled={!canImport} onClick={() => setImportOpen(true)} className="gap-1.5">
            <UploadIcon className="h-4 w-4" aria-hidden="true" />
            Import SDL
          </Button>
          <DropdownMenu modal={false}>
            <d.CustomNoDivTooltip title={EXPORT_TRIGGER_LABEL}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label={EXPORT_TRIGGER_LABEL}>
                  <DownloadIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </d.CustomNoDivTooltip>
            <DropdownMenuContent align="end">{exportItems}</DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <DropdownMenu modal={false}>
          <d.CustomNoDivTooltip title={MENU_TRIGGER_LABEL}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label={MENU_TRIGGER_LABEL}>
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
          </d.CustomNoDivTooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!canImport} onClick={() => setImportOpen(true)}>
              Import SDL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {exportItems}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isImportOpen && <d.ImportSdlDialog onClose={() => setImportOpen(false)} onImport={handleImported} exampleSdl={helloWorldTemplate.content} />}
    </>
  );
};

/**
 * Turns a deployment name into a safe `.yaml` filename: lowercased, non-alphanumeric runs collapsed to single
 * hyphens, edge hyphens trimmed, capped at 64 chars. An empty or symbol-only name falls back to `deployment`.
 */
function sdlFileName(deploymentName: string): string {
  const slug = deploymentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return `${slug || "deployment"}.yaml`;
}
