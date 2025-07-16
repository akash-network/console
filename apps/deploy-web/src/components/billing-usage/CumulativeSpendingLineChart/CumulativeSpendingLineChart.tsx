import React, { type FC } from "react";
import type { ChartConfig } from "@akashnetwork/ui/components";
import { Card, CardContent, CardHeader, CardTitle, ChartContainer, ChartTooltip, ChartTooltipContent, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

export type CumulativeSpendingChartData = Array<{
  date: string;
  totalUsdSpent: number;
}>;

const chartConfig = {
  totalUsdSpent: {
    label: "Total USD Spent"
  }
} satisfies ChartConfig;

export const COMPONENTS = {
  LineChart
};

export type CumulativeSpendingLineChartProps = {
  isFetching: boolean;
  data: CumulativeSpendingChartData;
  components?: typeof COMPONENTS;
};

export const CumulativeSpendingLineChart: FC<CumulativeSpendingLineChartProps> = ({ isFetching, data, components: C = COMPONENTS }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-6">
        <CardTitle className="text-lg">Cumulative Spending</CardTitle>
        {isFetching && <Spinner size="small" variant="dark" />}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className={cn("h-[298px] w-full", isFetching && "pointer-events-none")} role="chart-container">
          <C.LineChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12
            }}
            role="line-chart"
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={value => {
                const date = new Date(value);
                return isNaN(date.getTime()) ? value : format(date, "M/d");
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[180px]"
                  nameKey="totalUsdSpent"
                  labelFormatter={value => {
                    const date = new Date(value);
                    return isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy");
                  }}
                />
              }
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
          </C.LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
