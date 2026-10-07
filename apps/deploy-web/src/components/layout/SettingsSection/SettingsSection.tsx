"use client";
import React, { type ReactNode, useId } from "react";
import { cn } from "@akashnetwork/ui/utils";

type Props = {
  title: string;
  aside?: ReactNode;
  destructive?: boolean;
  children: ReactNode;
};

export const SettingsSection: React.FunctionComponent<Props> = ({ title, aside, destructive, children }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-baseline justify-between gap-3 pb-3 pt-2">
        <h2
          id={headingId}
          className={cn(
            "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em]",
            destructive ? "font-semibold text-destructive" : "text-muted-foreground"
          )}
        >
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
};
