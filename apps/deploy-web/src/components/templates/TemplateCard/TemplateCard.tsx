"use client";
import type { FC } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { UrlService } from "@src/utils/urlUtils";

export interface TemplateCardProps {
  template: TemplateOutputSummaryWithCategory;
  isPopular: boolean;
}

export const TemplateCard: FC<TemplateCardProps> = ({ template, isPopular }) => (
  <Link
    href={UrlService.templateDetails(template.id)}
    prefetch={false}
    className="group flex flex-col rounded-[14px] border border-border bg-card px-[18px] pb-3.5 pt-4 text-card-foreground !no-underline shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-blue-600/45 hover:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.12),0_0_0_1px_rgba(37,99,235,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <div className="flex items-center gap-2">
      <h3 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">{template.name}</h3>
      {isPopular && <PopularBadge />}
    </div>

    <p className="mt-2 line-clamp-2 min-h-[34px] break-words text-[12.5px] leading-[17px] text-muted-foreground">{template.summary}</p>

    <div className="min-h-3.5 flex-1" />
    <div className="-mx-[18px] h-px bg-border" />
    <div className="mt-3 flex items-center justify-end gap-1 text-[12.5px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
      View
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </div>
  </Link>
);

const PopularBadge: FC = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-600/25 bg-blue-600/10 px-2 py-0.5 font-mono text-[11.5px] font-medium text-blue-600 dark:text-blue-400">
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    Popular
  </span>
);
