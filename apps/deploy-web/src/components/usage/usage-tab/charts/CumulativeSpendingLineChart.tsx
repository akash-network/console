"use client";

import React, { type FC } from "react";
import type { ChartConfig } from "@akashnetwork/ui/components";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, ChartContainer, ChartTooltip, ChartTooltipContent, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format, isAfter, isBefore, startOfTomorrow, subDays } from "date-fns";
import { GraphDown, GraphUp } from "iconoir-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

type ChartData = Array<{
  date: string;
  totalUsdSpent: number;
}>;

const chartConfig = {
  totalUsdSpent: {
    label: "Total USD Spent"
  }
} satisfies ChartConfig;

export type CumulativeSpendingLineChartProps = {
  isFetching: boolean;
  data: ChartData;
};

export const CumulativeSpendingLineChart: FC<CumulativeSpendingLineChartProps> = ({ isFetching, data }) => {
  const calculateSpendingChange = () => {
    if (data.length < 2) return 0;

    const tomorrow = startOfTomorrow();
    const monthAgo = subDays(tomorrow, 31);

    const lastMonthData = data
      .filter(item => {
        const date = new Date(item.date);

        return isAfter(date, monthAgo) && isBefore(date, tomorrow);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (lastMonthData.length < 2) return 0;

    const firstValue = lastMonthData[0].totalUsdSpent;
    const lastValue = lastMonthData[lastMonthData.length - 1].totalUsdSpent;

    if (firstValue === 0) return 0;

    const percentageChange = ((lastValue - firstValue) / firstValue) * 100;

    return Math.round(percentageChange * 100) / 100;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-6">
        <CardTitle className="text-lg">Cumulative Spending</CardTitle>
        {isFetching && <Spinner size="small" variant="dark" />}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className={cn("h-[298px] w-full", isFetching && "pointer-events-none")}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={value => format(new Date(value), "M/d")} />
            <ChartTooltip
              content={<ChartTooltipContent className="w-[180px]" nameKey="totalUsdSpent" labelFormatter={value => format(new Date(value), "MMM d, yyyy")} />}
            />
            <Line
              dataKey="totalUsdSpent"
              type="linear"
              stroke="hsl(var(--primary))"
              dot={{
                fill: "hsl(var(--primary))"
              }}
              strokeWidth={2}
              className={cn(isFetching && "opacity-50")}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex gap-2 text-sm font-medium leading-none">
          <TrendIndicator change={calculateSpendingChange()} />
        </div>
      </CardFooter>
    </Card>
  );
};

const TrendIndicator: FC<{ change: number }> = ({ change }) => {
  if (change === 0) return null;

  const isUp = change > 0;
  return (
    <p className="mt-2 text-gray-500">
      Trending {isUp ? "up" : "down"} by {Math.abs(change)}% {isUp ? <GraphUp className="inline h-4 w-4" /> : <GraphDown className="inline h-4 w-4" />}
    </p>
  );
};
