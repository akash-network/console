"use client"
import { forwardRef } from "react";
import dynamic from "next/dynamic";

import { IProps, XTermRefType } from "./XTerm";

const _DynamicXTerm = dynamic(() => import("./XTerm"), { ssr: false });

export const XTerm = forwardRef<XTermRefType, IProps>((props, ref) => <_DynamicXTerm {...props} customRef={ref} />);
