"use client";
import { monacoOptions } from "@src/utils/constants";
import dynamic from "next/dynamic";
import { OnChange, OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";

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
      options={{ ...monacoOptions, ...options }}
      onMount={onMount}
    />
  );
};
