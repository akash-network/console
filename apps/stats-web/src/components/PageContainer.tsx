"use client";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children?: ReactNode;
  className?: string;
};

export const PageContainer: React.FunctionComponent<Props> = ({ children, className = "" }) => {
  return <div className={cn("mx-auto w-full max-w-page px-4 pb-8 sm:px-6", className)}>{children}</div>;
};
