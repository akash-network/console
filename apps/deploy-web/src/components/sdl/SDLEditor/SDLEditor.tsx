"use client";

import type { ComponentProps } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import type { SDLInput } from "@akashnetwork/chain-sdk/web";
import { validateSDL } from "@akashnetwork/chain-sdk/web";
import type * as monacoModule from "monaco-editor";

import type { IStandaloneCodeEditor } from "@src/components/shared/DynamicMonacoEditor/DynamicMonacoEditor";
import { MemoMonaco } from "@src/components/shared/MemoMonaco";
import { useServices } from "@src/context/ServicesProvider";
import { getMonacoErrorMarkers } from "./getMonacoErrorMarkers";

export type Props = Omit<ComponentProps<typeof MemoMonaco>, "language" | "onValidate"> & {
  readonly?: boolean;
  onValidate?: (event: { isValid: boolean }) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  Editor: MemoMonaco
};

const MARKER_OWNER = "akash-sdl";
let editorId = 0;

export const SDLEditor = forwardRef<SdlEditorRefType, Props>(({ onChange, onValidate, dependencies: d = DEPENDENCIES, ...props }, ref) => {
  const { networkStore } = useServices();
  const networkId = networkStore.useSelectedNetworkId();
  const stateRef = useRef<EditorState>({
    editor: null,
    monaco: null,
    validationVersion: 0,
    validationTimerId: null,
    lastValue: "",
    editorId
  });

  const validate = useCallback(
    async (value: string, version: number) => {
      const state = stateRef.current;
      if (!state) return false;
      if (version !== stateRef.current?.validationVersion) return false;

      const { editor, monaco } = state;
      const model = editor?.getModel();
      if (!model) return false;

      const { parseDocument } = await import("yaml");

      const doc = parseDocument(value, { keepSourceTokens: true });
      if (doc.errors.length) {
        onValidate?.({ isValid: false });
        // if there are errors, yaml is invalid and builtin monaco editor yaml service will show errors
        return false;
      }
      const errors = validateSDL(doc.toJSON() as SDLInput, networkId);
      const markers = errors ? getMonacoErrorMarkers(errors, doc, value) : [];
      const isValid = markers.length === 0;
      onValidate?.({ isValid });
      monaco?.editor.setModelMarkers(model, MARKER_OWNER, markers);
      return isValid;
    },
    [networkId, onChange, onValidate]
  );

  const scheduleValidation = useCallback(
    (value: string) => {
      if (!stateRef.current || value === stateRef.current.lastValue) return;

      if (stateRef.current.validationTimerId) {
        clearTimeout(stateRef.current.validationTimerId);
      }

      const version = ++stateRef.current.validationVersion;
      stateRef.current.validationTimerId = setTimeout(() => {
        validate(value, version);
        stateRef.current.lastValue = value;
        stateRef.current.validationTimerId = null;
      }, 200);
    },
    [validate]
  );

  const setupValidation = useCallback(
    (editor: IStandaloneCodeEditor, monaco: typeof monacoModule) => {
      props.onMount?.(editor, monaco);
      stateRef.current = {
        editor,
        monaco,
        validationVersion: 0,
        validationTimerId: null,
        lastValue: "",
        editorId: stateRef.current.editorId
      };
      editorId++;

      const model = editor.getModel();
      if (!model) return;

      const initialValue = model.getValue();
      if (initialValue) {
        scheduleValidation(initialValue);
      }

      const contentDisposable = model.onDidChangeContent(event => {
        const value = model.getValue();
        onChange?.(value, event);
        if (value) {
          scheduleValidation(value);
        } else {
          monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
        }
      });

      editor.onDidDispose(() => {
        contentDisposable.dispose();
        if (stateRef.current?.validationTimerId) {
          clearTimeout(stateRef.current.validationTimerId);
        }
        stateRef.current = {
          editor: null,
          monaco: null,
          validationVersion: 0,
          validationTimerId: null,
          lastValue: "",
          editorId: NaN
        };
      });
    },
    [scheduleValidation, onChange]
  );

  useImperativeHandle(ref, () => ({
    validate: () => {
      if (stateRef.current.validationTimerId) {
        clearTimeout(stateRef.current.validationTimerId);
      }
      return validate(stateRef.current.editor?.getModel()?.getValue() || "", stateRef.current.validationVersion);
    }
  }));

  return (
    <d.Editor
      {...props}
      language="yaml"
      path={`file:///akash-sdl.${stateRef.current.editorId}.yaml`}
      onMount={setupValidation}
      options={{
        ...props.options,
        readOnly: !!props.readonly,
        domReadOnly: !!props.readonly,
        hover: {
          enabled: true,
          ...(props.options?.hover as Record<string, unknown>)
        }
      }}
    />
  );
});

interface EditorState {
  editor: IStandaloneCodeEditor | null;
  monaco: typeof monacoModule | null;
  validationVersion: number;
  validationTimerId: ReturnType<typeof setTimeout> | null;
  lastValue: string;
  editorId: number;
}

export type SdlEditorRefType = {
  validate: () => Promise<boolean>;
};
