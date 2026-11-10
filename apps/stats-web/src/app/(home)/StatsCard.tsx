"use client";
import React from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { CircleQuestionMark } from "lucide-react";

import { DiffPercentageChip } from "@/components/DiffPercentageChip";
import { Link } from "@/components/Link/Link";
import { Eyebrow, Panel } from "@/components/stats/Panel";

interface IStatsCardProps {
  number: React.ReactNode;
  subNumber?: React.ReactNode;
  text: string;
  diffPercent?: number;
  tooltip?: string | React.ReactNode;
  graphPath?: string;
}

export const StatsCard: React.FunctionComponent<IStatsCardProps> = ({ number, subNumber, text, tooltip, graphPath, diffPercent }) => {
  return (
    <Panel className="flex flex-col gap-2.5 px-5 py-[18px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Eyebrow>{text}</Eyebrow>
          {tooltip && (
            <CustomTooltip title={tooltip}>
              <CircleQuestionMark className="h-3.5 w-3.5 text-faint" />
            </CustomTooltip>
          )}
        </div>
        {graphPath && (
          <Link href={graphPath} className="whitespace-nowrap text-xs font-medium text-muted-foreground hover:text-akash hover:no-underline">
            Graph →
          </Link>
        )}
      </div>
      <div className="text-[26px] font-semibold tabular-nums leading-none tracking-[-0.02em]">{number}</div>
      {subNumber}
      {!!diffPercent && <DiffPercentageChip value={diffPercent} />}
    </Panel>
  );
};
