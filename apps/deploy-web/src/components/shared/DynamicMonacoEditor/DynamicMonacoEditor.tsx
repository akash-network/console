"use client";
import { validationSDLSchema } from "@akashnetwork/chain-sdk/web";
import { Skeleton } from "@akashnetwork/ui/components";
import type { Editor, OnValidate } from "@monaco-editor/react";
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

export async function loadMonacoEditor(): Promise<typeof Editor> {
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

  if (typeof monacoYamlModule.configureMonacoYaml === "function") {
    // can be stubbed in tests, so check if function exists before calling
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
  }

  return monacoReactModule.Editor;
}

export type Props = {
  theme?: string;
  value: string;
  height?: string | number;
  language?: "yaml" | "plaintext" | "log";
  onChange?: OnChange;
  onMount?: OnMount;
  onValidate?: OnValidate;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  path?: string;
};

function EditorSkeleton() {
  const lines = [75, 60, 85, 45, 70, 55, 80, 40, 65, 50, 90, 35, 70, 60, 75];
  const skeletonBar = "bg-[#e0e0e0] dark:bg-[#3c3c3c]";
  return (
    <div className="flex h-full w-full bg-white dark:bg-[#1e1e1e]">
      <div className="flex w-[60px] shrink-0 flex-col items-end gap-[6px] border-r border-[#e8e8e8] py-1 pr-3 dark:border-[#333]">
        {lines.map((_, i) => (
          <Skeleton key={i} className={`h-[18px] w-5 rounded-sm ${skeletonBar}`} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-[6px] py-1 pl-4">
        {lines.map((width, i) => (
          <Skeleton key={i} className={`h-[18px] rounded-sm ${skeletonBar}`} style={{ width: `${width}%` }} />
        ))}
      </div>
    </div>
  );
}

const LazyMonacoEditor = dynamic(loadMonacoEditor, { ssr: false, loading: () => <EditorSkeleton /> });
export const DynamicMonacoEditor: React.FunctionComponent<Props> = ({
  path,
  theme,
  value,
  height = "100%",
  onChange,
  onMount,
  onValidate,
  language = "plaintext",
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
      wrapperProps={{ "data-testid": "monaco-editor" }}
      path={path}
    />
  );
};
