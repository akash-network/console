"use client";
import React from "react";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@akashnetwork/ui/components";
import { Area, AreaChart, XAxis } from "recharts";

interface DashboardChartsProps {
  data: number[];
  labels: string[];
  title?: string;
}

const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 }
];

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "rgb(255,66,76)"
  },
  mobile: {
    label: "Mobile",
    color: "rgb(255,66,76)"
  }
} satisfies ChartConfig;

export const StatLineCharts: React.FC<DashboardChartsProps> = () => {
  return (
    <div>
      {/* <div id="chart">{typeof window !== "undefined" && <Chart options={chartOptions} series={chartvariable.series} type="line" height={125} />}</div> */}
      <ChartContainer config={chartConfig} className="min-h-[150px] w-full">
        <AreaChart
          data={chartData}
          margin={{
            left: 12,
            right: 12
          }}
        >
          {/* <CartesianGrid vertical={false} /> */}
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={value => value.slice(0, 3)} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          <Area dataKey="desktop" type="natural" fill="var(--color-desktop)" fillOpacity={0.4} stroke="var(--color-desktop)" />
        </AreaChart>
      </ChartContainer>
      <div id="html-dist"></div>
    </div>
  );
};
