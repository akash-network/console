import type { FC, ReactNode } from "react";

export type FCWithFnChildren<P = object, ChildrenProps = undefined> = FC<P & { children: (props: ChildrenProps) => ReactNode }>;
export type FCWithChildren<P = object> = FC<P & { children?: ReactNode }>;
