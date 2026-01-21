"use client";
import { validationSDLSchema } from "@akashnetwork/chain-sdk/web";
import type { OnValidate } from "@monaco-editor/react";
import { type OnChange, type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

export type IStandaloneCodeEditor = monaco.editor.IStandaloneCodeEditor;
export type IMarker = monaco.editor.IMarker;
export type monaco2 = typeof monaco;

export const MONACO_OPTIONS = {
  selectOnLineNumbers: true,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  scrollbar: {
    verticalScrollbarSize: 8
  },
  minimap: {
    enabled: false
  },
  padding: {
    bottom: 50
  },
  hover: {
    enabled: false
  },
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true
  },
  formatOnType: true
};

const LazyMonacoEditor = dynamic(
  async () => {
    // Set up Monaco environment for workers - must be done before importing monaco
    // This is inside dynamic() to ensure it's not included in server bundle
    globalThis.MonacoEnvironment = {
      getWorker(_moduleId: string, label: string) {
        switch (label) {
          case "editorWorkerService":
            return new Worker(new URL("./monaco.worker.ts", import.meta.url), { type: "module" });
          case "yaml":
            return new Worker(new URL("./yaml.worker.ts", import.meta.url), { type: "module" });
          default:
            throw new Error(`Unknown label ${label}`);
        }
      }
    };

    import("yaml"); // preload yaml module, we will need it for validation soon
    const [monacoReactModule, monacoModule, monacoYamlModule] = await Promise.all([
      import("@monaco-editor/react"),
      import("./monaco-editor"),
      import("monaco-yaml")
    ]);

    monacoReactModule.loader.config({ monaco: monacoModule });

    // @ts-expect-error - partial monaco module works with monaco-yaml
    monacoYamlModule.configureMonacoYaml(monacoModule, {
      enableSchemaRequest: false,
      completion: true,
      format: false,
      validate: true,
      hover: true,
      schemas: [
        {
          fileMatch: ["file:///akash-sdl.*.yaml"],
          schema: {
            ...validationSDLSchema,
            markdownDescription:
              "Schema for Akash Stack Definition Language (SDL) YAML input files.\n" +
              "Check [documentation](https://akash.network/docs/developers/deployment/akash-sdl/) for more info.",
            description:
              "Schema for Akash Stack Definition Language (SDL) YAML input files.\n" +
              "Check https://akash.network/docs/developers/deployment/akash-sdl/ for more info."
          },
          uri: new URL("/sdl-schema.yaml", window.location.origin).toString()
        }
      ]
    });

    return monacoReactModule.Editor;
  },
  { ssr: false, loading: () => <div>Loading...</div> }
);

export type Props = {
  theme?: string;
  value: string;
  height?: string | number;
  language?: string;
  onChange?: OnChange;
  onMount?: OnMount;
  onValidate?: OnValidate;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  path?: string;
};

export const DynamicMonacoEditor: React.FunctionComponent<Props> = ({
  path,
  theme,
  value,
  height = "100%",
  onChange,
  onMount,
  onValidate,
  language = "yaml",
  options = {}
}) => {
  const { resolvedTheme } = useTheme();

  return (
    <LazyMonacoEditor
      height={height}
      language={language}
      defaultLanguage={language}
      theme={theme || (resolvedTheme === "dark" ? "vs-dark" : "hc-light")}
      value={value}
      onChange={onChange}
      onMount={onMount}
      onValidate={onValidate}
      options={{ ...MONACO_OPTIONS, ...options }}
      wrapperProps={{ className: "test-me-wrapper" }}
      path={path}
    />
  );
};
