import React, { type FC } from "react";
import type { ChartConfig } from "@akashnetwork/ui/components";
import { Card, CardContent, CardHeader, CardTitle, ChartContainer, ChartTooltip, ChartTooltipContent, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { TrendIndicator } from "@src/components/billing-usage/TrendIndicator/TrendIndicator";

export type CumulativeSpendingChartData = Array<{
  date: string;
  totalUsdSpent: number;
}>;

const chartConfig = {
  totalUsdSpent: {
    label: "Total USD Spent"
  }
} satisfies ChartConfig;

export const DEPENDENCIES = {
  LineChart,
  ChartContainer,
  CartesianGrid,
  XAxis,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  TrendIndicator,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner
};

export type CumulativeSpendingLineChartProps = {
  isFetching: boolean;
  data: CumulativeSpendingChartData;
  dependencies?: typeof DEPENDENCIES;
};

export const CumulativeSpendingLineChart: FC<CumulativeSpendingLineChartProps> = ({ isFetching, data, dependencies: d = DEPENDENCIES }) => {
  return (
    <d.Card>
      <d.CardHeader className="flex flex-row items-center gap-3 space-y-0 px-6">
        <d.CardTitle className="text-lg">Cumulative Spending</d.CardTitle>
        {isFetching && <d.Spinner size="small" variant="dark" />}
      </d.CardHeader>
      <d.CardContent>
        <d.ChartContainer config={chartConfig} className={cn("h-[298px] w-full", isFetching && "pointer-events-none")} role="chart-container">
          <d.LineChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12
            }}
            role="line-chart"
          >
            <d.CartesianGrid vertical={false} />
            <d.XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={value => {
                const date = new Date(value);
                return isNaN(date.getTime()) ? value : format(date, "M/d");
              }}
            />
            <d.ChartTooltip
              content={
                <d.ChartTooltipContent
                  className="w-[180px]"
                  nameKey="totalUsdSpent"
                  labelFormatter={value => {
                    const date = new Date(value);
                    return isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy");
                  }}
                />
              }
            />
            <d.Line
              dataKey="totalUsdSpent"
              type="linear"
              stroke="hsl(var(--primary))"
              dot={{
                fill: "hsl(var(--primary))"
              }}
              strokeWidth={2}
              className={cn(isFetching && "opacity-50")}
            />
          </d.LineChart>
        </d.ChartContainer>
        <d.TrendIndicator isFetching={isFetching} data={data} field="totalUsdSpent" />
      </d.CardContent>
    </d.Card>
  );
};
