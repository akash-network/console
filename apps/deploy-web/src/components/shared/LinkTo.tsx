"use client";
import React from "react";

import { cn } from "@src/utils/styleUtils";

export function LinkTo({ children, className = "", ...rest }: React.PropsWithChildren<{ className?: string } & React.ButtonHTMLAttributes<{}>>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        className,
        "text-primary visited:text-primary-visited m-0 inline-flex cursor-pointer border-0 bg-transparent p-0 underline disabled:cursor-default disabled:text-gray-500"
      )}
    >
      {children}
    </button>
  );
}
