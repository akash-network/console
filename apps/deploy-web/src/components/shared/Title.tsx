"use client";
import { ReactNode } from "react";

import { cn } from "@src/utils/styleUtils";

type Props = {
  children?: ReactNode;
  id?: string;
  hasMargin?: boolean;
  subTitle?: boolean;
  className?: string;
};

export const Title: React.FunctionComponent<Props> = ({ children, subTitle, id, className = "" }) => {
  return subTitle ? (
    <h3 className={cn("text-xl font-semibold sm:text-2xl", className)} id={id}>
      {children}
    </h3>
  ) : (
    <h1 className={cn("text-2xl font-bold tracking-tight sm:text-4xl", className)} id={id}>
      {children}
    </h1>
  );
};
