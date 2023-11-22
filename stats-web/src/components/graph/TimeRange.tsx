"use client";
import { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { selectedRangeValues } from "@/lib/constants";
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
        className={cn({ ["bg-secondary"]: selectedRange === selectedRangeValues["7D"] })}
        onClick={() => _onRangeChange(selectedRangeValues["7D"])}
        color="secondary"
        size="sm"
      >
        7D
      </ToggleGroupItem>
      <ToggleGroupItem
        value="1M"
        className={cn({ ["bg-secondary"]: selectedRange === selectedRangeValues["1M"] })}
        onClick={() => _onRangeChange(selectedRangeValues["1M"])}
        color="secondary"
        size="sm"
      >
        1M
      </ToggleGroupItem>
      <ToggleGroupItem
        value="ALL"
        className={cn({ ["bg-secondary"]: selectedRange === selectedRangeValues["ALL"] })}
        onClick={() => _onRangeChange(selectedRangeValues["ALL"])}
        color="secondary"
        size="sm"
      >
        ALL
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
