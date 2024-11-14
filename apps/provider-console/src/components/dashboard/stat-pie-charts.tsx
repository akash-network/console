"use client";
import React, { useMemo } from "react";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@akashnetwork/ui/components";

interface StatPieChartProps {
  activeResources: number;
  pendingResources: number;
  availableResources: number;
}

const COLORS = ["rgb(200, 80, 90)", "rgb(220, 170, 100)", "rgb(100, 180, 120)"];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
  if (value === 0) return null; // Don't render label if value is 0

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
      {value}
    </text>
  );
};

const chartConfig: ChartConfig = {
  active: {
    label: "Active Resources",
    color: COLORS[0]
  },
  pending: {
    label: "Pending Resources",
    color: COLORS[1]
  },
  available: {
    label: "Available Resources",
    color: COLORS[2]
  }
};

export const StatPieChart: React.FC<StatPieChartProps> = ({ activeResources, pendingResources, availableResources }) => {
  const data = useMemo(
    () => [
      { name: "Active", value: activeResources },
      { name: "Pending", value: pendingResources },
      { name: "Available", value: availableResources }
    ],
    [activeResources, pendingResources, availableResources]
  );

  return (
    <div>
      <ChartContainer config={chartConfig} className="min-h-[100px] w-full">
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              // labelLine={true}
              // label={renderCustomizedLabel}
              innerRadius={30}
              outerRadius={40}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={5}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
};
