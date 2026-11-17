import type { FC, Ref } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { PencilIcon } from "lucide-react";

import type { QuoteStepId } from "../gpuQuoteDraft/gpuQuoteDraft";
import type { ReceiptSection } from "../gpuQuoteDraft/gpuQuoteReceipt";

type Props = { sections: ReceiptSection[]; date: string; onChangeStep: (step: QuoteStepId) => void; receiptRef?: Ref<HTMLDivElement> };

export const GpuQuoteReceipt: FC<Props> = ({ sections, date, onChangeStep, receiptRef }) => (
  <div ref={receiptRef} className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,.05),0_24px_48px_-36px_rgba(0,0,0,.45)]">
    <div className="flex items-baseline justify-between gap-2.5 px-4 pb-3 pt-3.5">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Your request</span>
      <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{date}</span>
    </div>
    {sections.map(section => (
      <button
        key={section.step}
        type="button"
        title="Change"
        onClick={() => onChangeStep(section.step)}
        className="duration-[120ms] group relative flex w-full flex-col border-t border-dashed px-4 py-2 pr-[46px] text-left transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="sr-only">Change </span>
        {section.rows.map(row => (
          <span key={row.label} className="grid grid-cols-[78px_minmax(0,1fr)] gap-2.5 py-[3px]">
            <span className="font-mono text-[10px] font-semibold uppercase leading-[18px] tracking-[0.08em] text-muted-foreground">{row.label}</span>
            <span className={cn("min-w-0 text-[13px] font-medium leading-[18px] [overflow-wrap:anywhere]", !row.value && "font-normal text-muted-foreground")}>
              {row.value ?? "—"}
              {row.value && row.detail && (
                <span className="mt-px block font-mono text-[11.5px] font-normal leading-snug text-muted-foreground">{row.detail}</span>
              )}
            </span>
          </span>
        ))}
        <span
          aria-hidden="true"
          className="absolute right-2.5 top-1/2 inline-flex h-[26px] w-[26px] -translate-y-1/2 scale-90 items-center justify-center rounded-[7px] border bg-background opacity-0 shadow-sm transition group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
        >
          <PencilIcon className="h-[13px] w-[13px]" />
        </span>
      </button>
    ))}
  </div>
);
