import { useTheme } from "@mui/material/styles";
import { monacoOptions } from "@src/utils/constants";
import dynamic from "next/dynamic";
import { OnChange, OnMount } from "@monaco-editor/react";

const _DynamicMonacoEditor = dynamic(import("@monaco-editor/react"), { ssr: false });

type Props = {
  value: string;
  height?: string | number;
  language?: string;
  onChange?: OnChange;
  onMount?: OnMount;
  options?: object;
};

export const DynamicMonacoEditor: React.FunctionComponent<Props> = ({ value, height, onChange, onMount, language = "yaml", options = {} }) => {
  const theme = useTheme();

  return (
    <_DynamicMonacoEditor
      height={height}
      language={language}
      theme={theme.palette.mode === "dark" ? "vs-dark" : "hc-light"}
      value={value}
      onChange={onChange}
      options={{ ...monacoOptions, ...options }}
      onMount={onMount}
    />
  );
};
