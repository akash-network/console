import React from "react";
import { DynamicMonacoEditor } from "./DynamicMonacoEditor";
import isEqual from "lodash/isEqual";
import { OnChange, OnMount } from "@monaco-editor/react";

type Props = {
  value: string;
  language?: string;
  onChange?: OnChange;
  onMount?: OnMount;
  options?: object;
};

const _MemoMonaco: React.FunctionComponent<Props> = ({ value, onChange, onMount, language, options = {} }) => {
  return <DynamicMonacoEditor value={value} options={options} onChange={onChange} onMount={onMount} language={language} />;
};

export const MemoMonaco = React.memo(_MemoMonaco, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
