"use client";
import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@akashnetwork/ui/components";

import { SELECTED_RANGE_VALUES } from "@/config/date.config";
import { cn } from "@/lib/utils";

type Props = {
  children?: ReactNode;
  selectedRange: number;
  onRangeChange: (selectedRange: number) => void;
};

export const TimeRange: React.FunctionComponent<Props> = ({ selectedRange, onRangeChange }) => {
  const _onRangeChange = (selectedRange: number) => {
    onRangeChange(selectedRange);
  };

  return (
    <ToggleGroup type="single" aria-label="Graph range select" color="secondary" size="sm" className="mx-auto my-0 sm:mx-0">
      <ToggleGroupItem
        value="7D"
        className={cn({ ["!bg-primary font-bold !text-white"]: selectedRange === SELECTED_RANGE_VALUES["7D"] })}
        onClick={() => _onRangeChange(SELECTED_RANGE_VALUES["7D"])}
        size="sm"
      >
        7D
      </ToggleGroupItem>
      <ToggleGroupItem
        value="1M"
        className={cn({ ["!bg-primary font-bold !text-white"]: selectedRange === SELECTED_RANGE_VALUES["1M"] })}
        onClick={() => _onRangeChange(SELECTED_RANGE_VALUES["1M"])}
        size="sm"
      >
        1M
      </ToggleGroupItem>
      <ToggleGroupItem
        value="ALL"
        className={cn({ ["!bg-primary font-bold !text-white"]: selectedRange === SELECTED_RANGE_VALUES["ALL"] })}
        onClick={() => _onRangeChange(SELECTED_RANGE_VALUES["ALL"])}
        size="sm"
      >
        ALL
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
