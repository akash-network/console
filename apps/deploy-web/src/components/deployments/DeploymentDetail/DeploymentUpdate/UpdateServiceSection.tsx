"use client";
import type { FC } from "react";
import { useWatch } from "react-hook-form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Input } from "@akashnetwork/ui/components";
import { NavArrowDown, NavArrowRight } from "iconoir-react";
import { LockIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import { UpdateImageSection } from "./UpdateImageSection";
import { UpdateNetworkingSection } from "./UpdateNetworkingSection";
import { UpdateSectionRule } from "./UpdateSectionRule";

export interface UpdateServiceSectionProps {
  serviceIndex: number;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locked: boolean;
}

export const UpdateServiceSection: FC<UpdateServiceSectionProps> = ({ serviceIndex, title, open, onOpenChange, locked }) => {
  const image = useWatch<SdlBuilderFormValuesType, `services.${number}.image`>({ name: `services.${serviceIndex}.image` }) ?? "";

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="overflow-hidden rounded-lg border bg-background">
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {open ? <NavArrowDown className="h-4 w-4 shrink-0" aria-hidden="true" /> : <NavArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
        <span className="text-base font-medium">{title}</span>
        <LockIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="ml-auto truncate font-mono text-sm text-muted-foreground">{imageTagOf(image)}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div role="region" aria-label={title} className="flex flex-col gap-6 border-t px-4 py-5">
          <UpdateImageSection serviceIndex={serviceIndex} locked={locked} />
          <HardwareSection serviceIndex={serviceIndex} />
          <UpdateNetworkingSection serviceIndex={serviceIndex} locked={locked} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

function imageTagOf(image: string): string {
  return image.split("/").pop() ?? image;
}

const HardwareSection: FC<{ serviceIndex: number }> = ({ serviceIndex }) => {
  const service = useWatch<SdlBuilderFormValuesType, `services.${number}`>({ name: `services.${serviceIndex}` });
  const storage = service?.profile?.storage?.[0];

  return (
    <div className="flex flex-col gap-3">
      <UpdateSectionRule
        title="Hardware"
        trailing={
          <span className="flex items-center gap-1">
            <LockIcon className="h-3 w-3" aria-hidden="true" />
            Fixed for this lease
          </span>
        }
      />
      <div className="grid gap-3 md:grid-cols-4">
        <FixedField label="vCPU" value={String(service?.profile?.cpu ?? "")} />
        <FixedField label="Memory" value={`${service?.profile?.ram ?? ""} ${service?.profile?.ramUnit ?? ""}`.trim()} />
        <FixedField label="Ephemeral storage" value={storage ? `${storage.size} ${storage.unit}` : ""} />
        <FixedField label="Instances" value={String(service?.count ?? "")} />
      </div>
    </div>
  );
};

const FixedField: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm">{label}</span>
    <Input aria-label={label} value={value} disabled readOnly inputClassName="h-10 border-dashed font-mono" />
  </div>
);
