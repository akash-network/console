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

type ChartData = Array<{
  date: string;
  dailyUsdSpent: number;
}>;

type DailyUsageBarChartProps = {
  isFetching: boolean;
  data: ChartData;
};

export const DailyUsageBarChart: FC<DailyUsageBarChartProps> = ({ isFetching, data }) => {
  return (
    <Card className="w-full py-0">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b px-6">
        <CardTitle className="text-lg">Daily Usage</CardTitle>
        {isFetching && <Spinner size="small" />}
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={chartConfig} className={cn("aspect-auto h-[250px] w-full", isFetching && "pointer-events-none")}>
          <BarChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} tickFormatter={value => format(new Date(value), "M/d")} />
            <ChartTooltip
              content={<ChartTooltipContent className="w-[150px]" nameKey="dailyUsdSpent" labelFormatter={value => format(new Date(value), "MMM d, yyyy")} />}
            />
            <Bar dataKey="dailyUsdSpent" fill="hsl(var(--primary))" className={cn(isFetching && "opacity-80")} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
