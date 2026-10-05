"use client";
import type { FC } from "react";
import { useId } from "react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

export interface StartFromScratchCardProps {
  title: string;
  description: string;
  example: string;
  artSrc: string;
  onSelect: () => void;
}

export const StartFromScratchCard: FC<StartFromScratchCardProps> = ({ title, description, example, artSrc, onSelect }) => {
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
      <span className="relative block h-[150px] w-full shrink-0 border-b border-border bg-[#0A0A0B]">
        <Image src={artSrc} alt="" fill sizes="(min-width: 768px) 600px, 100vw" className="object-cover" />
      </span>

      <span className="flex w-full flex-1 flex-col px-[18px] pb-3.5 pt-3.5">
        <span id={titleId} className="text-base font-bold tracking-tight">
          {title}
        </span>
        <span id={descriptionId} className="mt-2.5 flex-1 text-[12.5px] leading-[17px] text-muted-foreground">
          {description}
        </span>

        <span className="-mx-[18px] mt-3.5 h-px w-[calc(100%_+_36px)] bg-border" />

        <span className="mt-3 flex h-[30px] w-full items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            Example: <span className="font-mono">{example}</span>
          </span>
          <span
            className="inline-flex shrink-0 translate-x-1 items-center gap-1.5 text-[12.5px] font-semibold opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
            aria-hidden="true"
          >
            Continue
            <ArrowRight className="h-3 w-3" />
          </span>
        </span>
      </span>
    </button>
  );
};
