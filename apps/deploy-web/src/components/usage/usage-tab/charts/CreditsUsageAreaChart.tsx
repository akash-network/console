"use client";

import React, { type FC } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Spinner
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

type ChartData = Array<{
  date: string;
  credits: number;
  used: number;
}>;

const chartConfig = {
  credits: {
    label: "Credits",
    color: "hsl(var(--success))"
  },
  used: {
    label: "Used",
    color: "hsl(var(--primary))"
  }
} satisfies ChartConfig;

type CreditsUsageAreaChartProps = {
  isFetching: boolean;
  data: ChartData;
};

export const CreditsUsageAreaChart: FC<CreditsUsageAreaChartProps> = ({ data, isFetching }) => {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-6">
        <CardTitle className="text-lg">Credit use</CardTitle>
        {isFetching && <Spinner size="small" />}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className={cn("aspect-auto h-[250px] w-full", isFetching && "pointer-events-none")}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillCredits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-credits)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-credits)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillUsed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-used)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-used)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} tickFormatter={value => format(new Date(value), "M/d")} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={value => format(new Date(value), "MMM d, yyyy")} indicator="dot" />} />
            <Area dataKey="used" type="natural" fill="url(#fillUsed)" stroke="var(--color-used)" stackId="a" className={cn(isFetching && "opacity-50")} />
            <Area
              dataKey="credits"
              type="natural"
              fill="url(#fillCredits)"
              stroke="var(--color-credits)"
              stackId="a"
              className={cn(isFetching && "opacity-50")}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
