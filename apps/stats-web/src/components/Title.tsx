"use client";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children?: ReactNode;
  subTitle?: boolean;
  className?: string;
};

export const Title: React.FunctionComponent<Props> = ({ children, subTitle, className = "" }) => {
  return subTitle ? (
    <h2 className={cn("text-[15px] font-semibold leading-snug tracking-normal", className)}>{children}</h2>
  ) : (
    <h1 className={cn("pt-7 text-2xl font-semibold leading-tight tracking-[-0.025em]", className)}>{children}</h1>
  );
};
