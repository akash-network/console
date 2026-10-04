"use client";
import type { FC } from "react";
import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { ApiProviderDetail } from "@src/types/provider";

type Props = {
  attributes: ApiProviderDetail["attributes"];
};

export const RawAttributesCard: FC<Props> = ({ attributes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Raw attributes</h2>
        <span className="rounded-full bg-muted px-[7px] py-px font-mono text-[10px] text-muted-foreground">{attributes.length}</span>
        <span className="flex-1" />
        <span className="hidden text-[11px] text-muted-foreground sm:inline">On-chain, as published by the operator</span>
      </button>
      {isOpen && (
        <dl id={contentId} className="border-t px-3.5 pb-3.5 pt-2.5 md:columns-2 md:gap-7">
          {attributes.map(attribute => (
            <div key={`${attribute.key}=${attribute.value}`} className="flex break-inside-avoid justify-between gap-3.5 border-b py-[4.5px]">
              <dt className="min-w-0 truncate font-mono text-[10.5px] text-muted-foreground" title={attribute.key}>
                {attribute.key}
              </dt>
              <dd className="min-w-0 truncate font-mono text-[10.5px] text-foreground" title={attribute.value}>
                {attribute.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};
