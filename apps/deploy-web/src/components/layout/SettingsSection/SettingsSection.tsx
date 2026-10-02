"use client";
import React, { type ReactNode, useId } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export const SettingsSection: React.FunctionComponent<Props> = ({ title, children }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="pb-3 pt-2 font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
};
