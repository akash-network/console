"use client";
import type { FC, ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";

const ROW_LABEL_CLASSES = "text-sm font-semibold leading-5";

export const SettingsCard: FC<{ destructive?: boolean; children: ReactNode }> = ({ destructive, children }) => (
  <div className={cn("rounded-xl border bg-card", destructive && "border-destructive/35")}>{children}</div>
);

type SettingsRowProps = {
  label: string;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
};

export const SettingsRow: FC<SettingsRowProps> = ({ label, description, htmlFor, children }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-[18px] py-4 first:border-t-0">
    <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={ROW_LABEL_CLASSES}>
          {label}
        </label>
      ) : (
        <span className={ROW_LABEL_CLASSES}>{label}</span>
      )}
      {description && <p className="text-[13px] leading-normal text-muted-foreground">{description}</p>}
    </div>
    <div className="flex min-w-0 max-w-full items-center gap-2">{children}</div>
  </div>
);
