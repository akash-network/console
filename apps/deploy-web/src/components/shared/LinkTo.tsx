"use client";
import React from "react";

import { cn } from "@akashnetwork/ui/utils";

export function LinkTo({ children, className = "", ...rest }: React.PropsWithChildren<{ className?: string } & React.ButtonHTMLAttributes<object>>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        className,
        "m-0 inline-flex cursor-pointer border-0 bg-transparent p-0 text-primary underline visited:text-primary-visited disabled:cursor-default disabled:text-gray-500"
      )}
    >
      {children}
    </button>
  );
}
