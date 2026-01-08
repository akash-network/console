"use client";
import React from "react";
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, CustomTooltip } from "@akashnetwork/ui/components";
import { GraphUp, HelpCircle } from "iconoir-react";
import Link from "next/link";

import { DiffPercentageChip } from "@/components/DiffPercentageChip";

interface IStatsCardProps {
  number: React.ReactNode;
  text: string;
  diffNumber?: number;
  diffNumberUnit?: string;
  diffPercent?: number;
  tooltip?: string | React.ReactNode;
  graphPath?: string;
  actionButton?: string | React.ReactNode;
}

export const StatsCard: React.FunctionComponent<IStatsCardProps> = ({ number, text, tooltip, actionButton, graphPath, diffNumber, diffPercent }) => {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center space-y-0 pb-4">
        <CardTitle className="text-sm font-medium leading-none text-muted-foreground">{text}</CardTitle>
        {tooltip && (
          <CustomTooltip title={tooltip}>
            <HelpCircle className="ml-2 text-xs text-muted-foreground" />
          </CustomTooltip>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-end">
          <div className="text-2xl font-bold leading-none">{number}</div>

          {(!!diffNumber || !!diffPercent) && (
            <div className="inline-flex items-end">
              {/* {!!diffNumber && (
                <div className="ml-2 text-xs text-muted-foreground">
                  <DiffNumber className="flex items-center" value={diffNumber} unit={diffNumberUnit} />
                </div>
              )} */}

              {!!diffPercent && <DiffPercentageChip value={diffPercent} className="pl-2" />}
            </div>
          )}
        </div>
      </CardContent>

      {graphPath && (
        <CardFooter className="p-0">
          <Link href={graphPath} className="w-full">
            <Button
              aria-label="graph"
              size="sm"
              className="w-full rounded-t-[0px] bg-secondary text-sm hover:bg-secondary/80 dark:bg-secondary/50"
              variant="ghost"
            >
              <span className="mr-2">Graph</span>
              <GraphUp className="text-xs" />
            </Button>
          </Link>

          {actionButton}
        </CardFooter>
      )}
    </Card>
  );
};
