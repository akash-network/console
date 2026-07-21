"use client";
import type { FC } from "react";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
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
import type { editor } from "monaco-editor";
import { useTheme } from "next-themes";

import { SDLEditor } from "@src/components/sdl/SDLEditor/SDLEditor";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { importDeploymentState, isKnownSdlParserError, NoVisibleServiceError } from "../importDeploymentState/importDeploymentState";

/** An SDL well over any real deployment is almost certainly the wrong file; reject before reading it into memory. */
const MAX_SDL_FILE_BYTES = 512 * 1024;

export const DEPENDENCIES = { SDLEditor, FileButton, importDeploymentState };

type Props = {
  onClose: () => void;
  onImport: (state: ImportedDeploymentState, meta: { method: "paste" | "file" }) => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The import dialog for the configure screen: an SDL editor to paste into plus an upload button that
 * populates the same editor. The single "Import" action is the only validate/apply path — uploading a file
 * never bypasses it. A failed import shows an inline message and leaves the parent form untouched.
 */
export const ImportSdlDialog: FC<Props> = ({ onClose, onImport, dependencies: d = DEPENDENCIES }) => {
  const { resolvedTheme } = useTheme();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const untouchedUploadedFileRef = useRef(false);
  /** Guards against a slow FileReader overwriting newer text: a read applies only while it is still the latest. */
  const fileReadGenerationRef = useRef(0);

  const focusOnMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    editorInstance.focus();
  }, []);

  function handleEditorChange(value?: string) {
    fileReadGenerationRef.current += 1;
    setText(value ?? "");
    setError(null);
    untouchedUploadedFileRef.current = false;
  }

  function handleValidate(event: { isValid: boolean }) {
    setIsValid(event.isValid);
  }

  function handleFileSelect(file: File | null) {
    if (!file) return;
    fileReadGenerationRef.current += 1;
    const generation = fileReadGenerationRef.current;
    if (file.size > MAX_SDL_FILE_BYTES) {
      setError("This file is too large to be an SDL. Choose a file under 512 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function populateEditor(event) {
      if (generation !== fileReadGenerationRef.current) return;
      const content = (event.target?.result as string) ?? "";
      untouchedUploadedFileRef.current = true;
      setText(content);
      setError(null);
    };
    reader.onerror = function reportReadFailure() {
      if (generation !== fileReadGenerationRef.current) return;
      setError("Couldn't read the file. Please try again.");
    };
    reader.readAsText(file);
  }

  function handleImport() {
    try {
      const state = d.importDeploymentState(text);
      onImport(state, { method: untouchedUploadedFileRef.current ? "file" : "paste" });
    } catch (err) {
      setError(describeImportError(err));
    }
  }

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onClose() : undefined)}>
      <DialogV2Content className="flex h-[600px] max-h-[85vh] max-w-3xl flex-col">
        <DialogV2Header>
          <DialogV2Title>Import SDL</DialogV2Title>
          <DialogV2Description>Paste your SDL below or upload a file. Importing replaces your current configuration.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex shrink-0 justify-end">
            <d.FileButton onFileSelect={handleFileSelect} accept=".yml,.yaml,.txt" size="sm" variant="outline">
              Upload file
            </d.FileButton>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
            <d.SDLEditor
              height="100%"
              value={text}
              onChange={handleEditorChange}
              onValidate={handleValidate}
              theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              onMount={focusOnMount}
            />
          </div>
          {error && (
            <Alert variant="destructive" className="shrink-0">
              {error}
            </Alert>
          )}
        </DialogV2Body>

        <DialogV2Footer>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!text.trim() || !isValid}>
            Import
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

/**
 * Turns an import failure into a user-facing message. Recognized parser/validation errors and the
 * no-service case carry a helpful message, so it is surfaced directly; anything else is parser-internal
 * noise and gets a fixed fallback.
 * Note: this consciously diverges from the mount path's fixed-message policy — showing `err.message` here
 * gives the "clear validation error" the feature requires, and React escapes text nodes so it is not an
 * injection vector. This function is the single swap point if that policy call is revisited.
 */
function describeImportError(err: unknown): string {
  if (err instanceof NoVisibleServiceError || isKnownSdlParserError(err)) {
    return err.message;
  }
  return "This SDL couldn't be parsed. Check the file and try again.";
}
