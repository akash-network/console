"use client";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@akashnetwork/ui/components";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface DashboardChartsProps {
  data: number[];
  labels: string[];
  title?: string; // Optional prop
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

export const DashboardCharts: React.FunctionComponent<DashboardChartsProps> = ({ data, labels, title }) => {
  const chartOptions: ApexOptions = {
    chart: {
      height: 125,
      type: "line",
      zoom: {
        enabled: false
      },
      toolbar: {
        show: false
      }
    },
    stroke: {
      curve: "smooth"
    },
    dataLabels: {
      enabled: true, // Enable data labels
      formatter: function (val) {
        return val.toString(); // Show the value as a label
      },
      style: {
        fontSize: "8px",
        colors: ["#515151"] // Color of the labels
      },
      offsetY: -5 // Adjust the position of the labels above the points
    },
    xaxis: {
      categories: labels,
      labels: {
        show: true
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      show: false
    },
    grid: {
      show: false
    }
  };
  const chartvariable = {
    series: [
      {
        name: "Data",
        data: data
      }
    ],
    options: {
      chart: {
        height: 150,
        type: "line",
        zoom: {
          enabled: false
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: "smooth"
      }
    }
  };

  return (
    <div>
      {/* <div id="chart">{typeof window !== "undefined" && <Chart options={chartOptions} series={chartvariable.series} type="line" height={125} />}</div> */}
      <ChartContainer config={chartConfig} className="min-h-[150px] w-full">
        <AreaChart
          accessibilityLayer
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
