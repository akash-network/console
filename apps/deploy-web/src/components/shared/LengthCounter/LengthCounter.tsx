import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export interface LengthCounterProps {
  length: number;
  max: number;
  id?: string;
}

export const LengthCounter: FC<LengthCounterProps> = ({ length, max, id }) => (
  <span id={id} className={cn("font-mono text-xs tabular-nums", length > max ? "text-destructive" : "text-muted-foreground")}>
    {NUMBER_FORMAT.format(length)} / {NUMBER_FORMAT.format(max)}
  </span>
);
