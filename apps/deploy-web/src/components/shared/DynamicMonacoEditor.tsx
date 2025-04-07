"use client";
import type { OnChange, OnMount } from "@monaco-editor/react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

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
  }
};

const _DynamicMonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div>Loading...</div> });

type Props = {
  value: string;
  height?: string | number;
  language?: string;
  onChange?: OnChange;
  onMount?: OnMount;
  options?: object;
};

export const DynamicMonacoEditor: React.FunctionComponent<Props> = ({ value, height = "100%", onChange, onMount, language = "yaml", options = {} }) => {
  const { resolvedTheme } = useTheme();

  return (
    <_DynamicMonacoEditor
      height={height}
      language={language}
      theme={resolvedTheme === "dark" ? "vs-dark" : "hc-light"}
      value={value}
      onChange={onChange}
      options={{ ...MONACO_OPTIONS, ...options }}
      onMount={onMount}
    />
  );
};
