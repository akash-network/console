"use client";
import React from "react";
import isEqual from "lodash/isEqual";

import { DynamicMonacoEditor, type Props as DynamicMonacoEditorProps } from "./DynamicMonacoEditor/DynamicMonacoEditor";

type Props = DynamicMonacoEditorProps;

const _MemoMonaco: React.FunctionComponent<Props> = props => {
  return <DynamicMonacoEditor {...props} />;
};

export const MemoMonaco = React.memo(_MemoMonaco, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
