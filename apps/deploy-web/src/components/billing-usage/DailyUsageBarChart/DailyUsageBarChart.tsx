import React, { type FC } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Spinner
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

const chartConfig = {
  dailyUsdSpent: {
    label: "USD Spent"
  }
} satisfies ChartConfig;

type ChartData = Array<{ date: string; dailyUsdSpent: number }>;

export const DEPENDENCIES = {
  BarChart,
  ChartContainer,
  CartesianGrid,
  XAxis,
  ChartTooltip,
  ChartTooltipContent,
  Bar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner
};

export type DailyUsageBarChartProps = {
  isFetching: boolean;
  data: ChartData;
  dependencies?: typeof DEPENDENCIES;
};

export const DailyUsageBarChart: FC<DailyUsageBarChartProps> = ({ isFetching, data, dependencies: d = DEPENDENCIES }) => {
  return (
    <d.Card className="w-full py-0">
      <d.CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b px-6">
        <d.CardTitle className="text-lg">Daily Usage</d.CardTitle>
        {isFetching && <d.Spinner size="small" variant="dark" />}
      </d.CardHeader>
      <d.CardContent className="px-2 sm:p-6">
        <d.ChartContainer config={chartConfig} className={cn("aspect-auto h-[250px] w-full", isFetching && "pointer-events-none")} role="chart-container">
          <d.BarChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12
            }}
            role="bar-chart"
          >
            <d.CartesianGrid vertical={false} />
            <d.XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={10}
              tickFormatter={value => {
                const date = new Date(value);
                return isNaN(date.getTime()) ? value : format(new Date(value), "M/d");
              }}
            />
            <d.ChartTooltip
              content={
                <d.ChartTooltipContent
                  className="w-[150px]"
                  nameKey="dailyUsdSpent"
                  labelFormatter={value => {
                    const date = new Date(value);
                    return isNaN(date.getTime()) ? value : format(new Date(value), "MMM d, yyyy");
                  }}
                />
              }
            />
            <d.Bar dataKey="dailyUsdSpent" fill="hsl(var(--primary))" className={cn(isFetching && "opacity-80")} />
          </d.BarChart>
        </d.ChartContainer>
      </d.CardContent>
    </d.Card>
  );
};
