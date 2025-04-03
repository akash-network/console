import type { FC, ReactNode } from "react";

export type FCWithChildren<P = object> = FC<P & { children?: ReactNode }>;
