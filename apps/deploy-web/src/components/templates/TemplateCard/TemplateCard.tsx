"use client";
import type { FC } from "react";
import type { TemplateHardware } from "@akashnetwork/http-sdk";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Cpu, Gpu, HardDrive, MemoryStick } from "lucide-react";
import Link from "next/link";

import { formatBytes } from "@src/components/deployments/ConfigureDeployment/DeploymentResourceSummary/deploymentResources";
import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { roundDecimal } from "@src/utils/mathHelpers";
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
    <div className="relative mt-3 flex min-h-[18px] items-center">
      {template.hardware && <HardwareProfile hardware={template.hardware} />}
      <span className="absolute bottom-0 right-0 inline-flex translate-x-1 items-center gap-1 bg-gradient-to-l from-card from-60% to-transparent pl-8 text-[12.5px] font-semibold leading-[18px] text-foreground opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
        View
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </div>
  </Link>
);

const HardwareProfile: FC<{ hardware: TemplateHardware }> = ({ hardware }) => (
  <ul aria-label="Hardware" className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
    {hardware.gpu && <HardwareStat icon={Gpu} label="GPU" value={describeGpu(hardware.gpu)} />}
    <HardwareStat icon={Cpu} label="vCPU" value={String(roundDecimal(hardware.cpu, 2))} />
    <HardwareStat icon={MemoryStick} label="Memory" value={formatBytes(hardware.memoryBytes)} />
    <HardwareStat icon={HardDrive} label="Storage" value={formatBytes(hardware.storageBytes)} />
  </ul>
);

const HardwareStat: FC<{ icon: LucideIcon; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <li title={label} className="inline-flex min-w-0 items-center gap-1.5">
    <Icon className="h-[15px] w-[15px] shrink-0 opacity-50" aria-hidden="true" />
    <span className="sr-only">{label}: </span>
    <span className="truncate whitespace-nowrap font-mono text-[12.5px] text-foreground/65">{value}</span>
  </li>
);

function describeGpu({ units, models }: NonNullable<TemplateHardware["gpu"]>): string {
  const accepted = models.length > 0 ? models.map(model => model.toUpperCase()).join(" / ") : "GPU";
  return `${units}× ${accepted}`;
}

const PopularBadge: FC = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-600/25 bg-blue-600/10 px-2 py-0.5 font-mono text-[11.5px] font-medium text-blue-600 dark:text-blue-400">
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    Popular
  </span>
);
