"use client";
import type { FC, ReactNode } from "react";
import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export interface StartFromScratchCardProps {
  title: string;
  description: string;
  previewLabel: string;
  previewIcon: LucideIcon;
  preview: ReactNode;
  onSelect: () => void;
}

export const StartFromScratchCard: FC<StartFromScratchCardProps> = ({ title, description, previewLabel, previewIcon: PreviewIcon, preview, onSelect }) => {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="group flex w-full min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card text-left text-card-foreground shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-blue-600/45 hover:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.12),0_0_0_1px_rgba(37,99,235,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className="relative block min-h-[118px] w-full shrink-0 overflow-hidden whitespace-pre border-b border-border bg-muted px-[18px] py-4 font-mono text-[12.5px] leading-[21px]"
      >
        <span className="absolute right-3.5 top-3 inline-flex items-center gap-1.5 text-[10.5px] uppercase leading-4 tracking-[0.08em] text-muted-foreground opacity-70">
          <PreviewIcon className="h-3 w-3 opacity-[0.55]" />
          {previewLabel}
        </span>
        {preview}
      </span>

      <span className="flex w-full flex-1 flex-col px-[18px] py-3.5">
        <span id={titleId} className="text-[17px] font-bold tracking-[-0.015em]">
          {title}
        </span>
        <span id={descriptionId} className="mt-1.5 flex-1 text-[13px] leading-[19px] text-muted-foreground">
          {description}
        </span>

        <span className="-mx-[18px] mt-3.5 h-px w-[calc(100%_+_36px)] bg-border" />

        <span className="mt-3 flex w-full items-center justify-end">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground" aria-hidden="true">
            Continue
            <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5" />
          </span>
        </span>
      </span>
    </button>
  );
};
