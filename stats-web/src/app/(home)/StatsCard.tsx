"use client";
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { DiffPercentageChip } from "@/components/DiffPercentageChip";
import { DiffNumber } from "@/components/DiffNumber";
import { LineChart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

export const StatsCard: React.FunctionComponent<IStatsCardProps> = ({
  number,
  text,
  tooltip,
  actionButton,
  graphPath,
  diffNumber,
  diffPercent,
  diffNumberUnit
}) => {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 pl-4 pr-4">
        <CardTitle className="text-sm font-medium">{text}</CardTitle>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle size="1rem" className="ml-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
      <CardContent className="pl-4 pr-4">
        <div className="flex items-end">
          <div className="leading-6 text-2xl font-bold">{number}</div>

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
            <Button aria-label="graph" size="sm" className="w-full rounded-t-[0px] text-sm" variant="secondary">
              <span className="mr-2">Graph</span>
              <LineChart size="1rem" />
            </Button>
          </Link>

          {actionButton}
        </CardFooter>
      )}
    </Card>
  );
};
