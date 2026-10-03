"use client";
import React, { type FC } from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { Calendar, Download } from "iconoir-react";

import { USAGE_DATE_PRESETS, type UsageDatePreset } from "@src/components/billing-usage/UsageContainer/usageDatePresets";

export type UsageHeaderActionsProps = {
  datePreset: UsageDatePreset;
  onDatePresetChange: (preset: UsageDatePreset) => void;
  onExport: () => void;
  isExportDisabled: boolean;
};

export const UsageHeaderActions: FC<UsageHeaderActionsProps> = ({ datePreset, onDatePresetChange, onExport, isExportDisabled }) => (
  <div className="flex flex-wrap items-center gap-2">
    <Select value={datePreset} onValueChange={value => onDatePresetChange(value as UsageDatePreset)}>
      <SelectTrigger aria-label="Date range" className="h-9 w-auto gap-2 text-[13px] font-medium">
        <Calendar className="h-[15px] w-[15px] text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {USAGE_DATE_PRESETS.map(preset => (
          <SelectItem key={preset.value} value={preset.value}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[13px]" onClick={onExport} disabled={isExportDisabled}>
      <Download className="h-[15px] w-[15px]" aria-hidden />
      Export CSV
    </Button>
  </div>
);
