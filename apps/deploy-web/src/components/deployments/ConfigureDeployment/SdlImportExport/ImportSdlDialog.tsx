"use client";
import type { DragEvent, FC, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  FileButton
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Check, FileUp, TriangleAlert } from "lucide-react";

import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { importDeploymentState } from "../importDeploymentState/importDeploymentState";
import type { SdlImportCheck } from "./checkSdlImport";
import { checkSdlImport } from "./checkSdlImport";

/** An SDL well over any real deployment is almost certainly the wrong file; reject before reading it into memory. */
const MAX_SDL_FILE_BYTES = 512 * 1024;

const SDL_PLACEHOLDER = 'Paste your SDL here…\n\nversion: "2.0"\nservices:\n  web:\n    image: nginx:1.27-alpine';

const DEFAULT_DESCRIPTION = "Paste a deploy.yaml to fill in placements, services, hardware, env vars, and ports. You can adjust everything afterwards.";

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { FileButton, importDeploymentState };

type ImportMethod = "paste" | "file" | "example";

export type ImportMeta = { method: ImportMethod };

type SdlSource = { method: ImportMethod; fileName?: string };

type ImportTarget =
  | { onImport: (state: ImportedDeploymentState, meta: ImportMeta) => void }
  | {
      /** The sdl as written, checked only against the sdl schema, for a caller that has no use for a form it may not fit. */
      onImportSdl: (sdl: string, meta: ImportMeta) => void;
    };

type Props = ImportTarget & {
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  /** Offered behind a "Use an example" link when given. */
  exampleSdl?: string;
  dependencies?: typeof DEPENDENCIES;
};

/** Paste-first SDL import: a file attached or dropped lands in the same box, and Apply stays disabled until the SDL checks out. */
export const ImportSdlDialog: FC<Props> = ({
  onClose,
  title = "Import SDL",
  description = DEFAULT_DESCRIPTION,
  exampleSdl,
  dependencies: d = DEPENDENCIES,
  ...target
}) => {
  const [text, setText] = useState("");
  const [source, setSource] = useState<SdlSource>({ method: "paste" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  /** Guards against a slow FileReader overwriting newer text: a read applies only while it is still the latest. */
  const fileReadGenerationRef = useRef(0);
  const fillsForm = "onImport" in target;

  const check = useMemo(() => checkSdlImport(text, fillsForm ? d.importDeploymentState : undefined), [text, fillsForm, d.importDeploymentState]);
  const status: SdlImportCheck = fileError ? { status: "invalid", reason: fileError } : check;

  function replaceText(value: string, nextSource: SdlSource) {
    fileReadGenerationRef.current += 1;
    setText(value);
    setSource(nextSource);
    setFileError(null);
  }

  function loadFile(file: File | null | undefined) {
    if (!file) return;
    fileReadGenerationRef.current += 1;
    const generation = fileReadGenerationRef.current;
    if (file.size > MAX_SDL_FILE_BYTES) {
      setFileError("This file is too large to be an SDL. Choose a file under 512 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function fillFromFile(event) {
      if (generation !== fileReadGenerationRef.current) return;
      setText((event.target?.result as string) ?? "");
      setSource({ method: "file", fileName: file.name });
      setFileError(null);
    };
    reader.onerror = function reportReadFailure() {
      if (generation !== fileReadGenerationRef.current) return;
      setFileError("Couldn't read the file. Please try again.");
    };
    reader.readAsText(file);
  }

  function showDropTarget(event: DragEvent) {
    event.preventDefault();
    setIsDraggingFile(true);
  }

  function loadDroppedFile(event: DragEvent) {
    event.preventDefault();
    setIsDraggingFile(false);
    loadFile(event.dataTransfer.files[0]);
  }

  function applySdl() {
    const meta: ImportMeta = { method: source.method };

    if ("onImportSdl" in target) {
      target.onImportSdl(text, meta);
      return;
    }

    target.onImport(d.importDeploymentState(text), meta);
  }

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onClose() : undefined)}>
      <DialogV2Content className="max-w-3xl">
        <DialogV2Header>
          <DialogV2Title>{title}</DialogV2Title>
          <DialogV2Description>{description}</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body className="flex flex-col gap-3">
          <div className="relative" onDragOver={showDropTarget} onDragLeave={() => setIsDraggingFile(false)} onDrop={loadDroppedFile}>
            <textarea
              aria-label="SDL"
              value={text}
              onChange={event => replaceText(event.target.value, { method: "paste" })}
              spellCheck={false}
              placeholder={SDL_PLACEHOLDER}
              className={cn(
                "block h-[300px] w-full resize-y rounded-[10px] border bg-card px-3.5 py-3 font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[12.5px] leading-5 text-foreground outline-none [tab-size:2] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring",
                isDraggingFile && "border-foreground"
              )}
            />
            {isDraggingFile && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[10px] bg-background/80 text-[13px] font-medium">
                Drop your .yaml file
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <d.FileButton onFileSelect={loadFile} accept=".yml,.yaml,.txt" size="sm" variant="outline" className="shrink-0 gap-1.5">
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
              Attach a file
            </d.FileButton>
            <span className="text-xs text-muted-foreground">
              {source.fileName ? `Loaded ${source.fileName}. Review it above.` : "…or drop a deploy.yaml onto the box above."}
            </span>
          </div>

          <SdlCheckStatus check={status} />
        </DialogV2Body>

        <DialogV2Footer>
          {exampleSdl && (
            <button
              type="button"
              onClick={() => replaceText(exampleSdl, { method: "example" })}
              className="text-[12.5px] text-muted-foreground underline underline-offset-[3px] transition-colors hover:text-foreground sm:mr-auto"
            >
              Use an example
            </button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={applySdl} disabled={status.status !== "valid"} className="gap-1.5">
            <Check className="h-4 w-4" aria-hidden="true" />
            Apply SDL
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

const SdlCheckStatus: FC<{ check: SdlImportCheck }> = ({ check }) => (
  <div
    role="status"
    className={cn(
      "flex min-h-10 items-start gap-2.5 rounded-[9px] border px-3 py-2.5 text-[12.5px] leading-[18px]",
      check.status === "invalid" ? "bg-destructive/5" : "bg-muted"
    )}
  >
    {check.status === "empty" && <span className="text-muted-foreground">We'll validate the SDL as you paste it.</span>}
    {check.status === "invalid" && (
      <>
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
        <span>{check.reason}</span>
      </>
    )}
    {check.status === "valid" && (
      <>
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">{describeCounts(check.placements)}</span>
          <span className="text-[11.5px] text-muted-foreground">
            {check.placements.map(placement => `${placement.name} (${placement.region ?? "any region"}): ${placement.services.join(", ")}`).join(" · ")}
          </span>
        </div>
      </>
    )}
  </div>
);

function describeCounts(placements: { services: string[] }[]): string {
  const serviceCount = new Set(placements.flatMap(placement => placement.services)).size;
  return `${pluralize(placements.length, "placement")} · ${pluralize(serviceCount, "service")}`;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
