"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Snackbar } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { saveAs } from "file-saver";
import { MoreHoriz } from "iconoir-react";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { ImportSdlDialog } from "./ImportSdlDialog";

/** Narrowed to the single call signature used here so tests can supply a plain stub. */
const saveBlobAs: (data: Blob, filename: string) => void = saveAs;

export const DEPENDENCIES = { ImportSdlDialog, useServices, useSnackbar, Snackbar, saveAs: saveBlobAs, copyTextToClipboard };

type Props = {
  /** The live SDL — exactly what Deploy would submit — used as the export source. */
  sdl: string;
  /** Names the exported file. */
  deploymentName: string;
  /** False while the flow is locked (quoting/deploying); disables Import only, Export stays available. */
  canImport: boolean;
  onImport: (state: ImportedDeploymentState) => void;
  dependencies?: typeof DEPENDENCIES;
};

/** SDL import/export actions for the configure toolbar, collapsed into a single overflow menu. */
export const SdlImportExport: FC<Props> = ({ sdl, deploymentName, canImport, onImport, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const [isImportOpen, setImportOpen] = useState(false);

  function handleImported(state: ImportedDeploymentState, meta: { method: "paste" | "file" }) {
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

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="SDL import and export">
            <MoreHoriz />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!canImport} onClick={() => setImportOpen(true)}>
            Import Config
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!sdl} onClick={handleDownload}>
            Download .yaml
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!sdl} onClick={handleCopy}>
            Copy to clipboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isImportOpen && <d.ImportSdlDialog onClose={() => setImportOpen(false)} onImport={handleImported} />}
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
