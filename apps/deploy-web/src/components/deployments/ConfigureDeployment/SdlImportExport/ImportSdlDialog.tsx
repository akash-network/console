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
import { importDeploymentState } from "../importDeploymentState/importDeploymentState";

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
  /** The exact text of the last uploaded file, so an unedited upload is reported as `method: "file"`. */
  const uploadedContentRef = useRef<string | null>(null);

  const focusOnMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    editorInstance.focus();
  }, []);

  function handleEditorChange(value?: string) {
    setText(value ?? "");
    setError(null);
  }

  function handleFileSelect(file: File | null) {
    if (!file) return;
    if (file.size > MAX_SDL_FILE_BYTES) {
      setError("This file is too large to be an SDL. Choose a file under 512 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function populateEditor(event) {
      const content = (event.target?.result as string) ?? "";
      uploadedContentRef.current = content;
      setText(content);
      setError(null);
    };
    reader.onerror = function reportReadFailure() {
      setError("Couldn't read the file. Please try again.");
    };
    reader.readAsText(file);
  }

  function handleImport() {
    try {
      const state = d.importDeploymentState(text);
      onImport(state, { method: text === uploadedContentRef.current ? "file" : "paste" });
    } catch (err) {
      setError(describeImportError(err));
    }
  }

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onClose() : undefined)}>
      <DialogV2Content className="max-w-3xl">
        <DialogV2Header>
          <DialogV2Title>Import SDL</DialogV2Title>
          <DialogV2Description>Paste your SDL below or upload a file. Importing replaces your current configuration.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body className="space-y-4">
          <div className="flex justify-end">
            <d.FileButton onFileSelect={handleFileSelect} accept=".yml,.yaml,.txt" size="sm" variant="outline">
              Upload file
            </d.FileButton>
          </div>
          <d.SDLEditor
            height="440px"
            value={text}
            onChange={handleEditorChange}
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            onMount={focusOnMount}
          />
          {error && <Alert variant="destructive">{error}</Alert>}
        </DialogV2Body>

        <DialogV2Footer>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!text.trim()}>
            Import
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

/**
 * Turns an import failure into a user-facing message. Parser errors (`YAMLException` with line/col,
 * validation errors, the no-service case) carry a helpful message, so it is surfaced directly; anything
 * else is parser-internal noise and gets a fixed fallback. Name-based checks match the legacy importer.
 * Note: this consciously diverges from the mount path's fixed-message policy — showing `err.message` here
 * gives the "clear validation error" the feature requires, and React escapes text nodes so it is not an
 * injection vector. This function is the single swap point if that policy call is revisited.
 */
function describeImportError(err: unknown): string {
  if (
    err instanceof Error &&
    (err.name === "NoVisibleServiceError" || err.name === "YAMLException" || err.name === "CustomValidationError" || err.name === "TemplateValidation")
  ) {
    return err.message;
  }
  return "This SDL couldn't be parsed. Check the file and try again.";
}
