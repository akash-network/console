"use client";
import React from "react";
import type { OnChange, OnMount } from "@monaco-editor/react";
import isEqual from "lodash/isEqual";

import { DynamicMonacoEditor } from "./DynamicMonacoEditor";

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
