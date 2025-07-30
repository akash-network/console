import React from "react";
import { isToday } from "date-fns";
import { GraphDown, GraphUp } from "iconoir-react";

const COMPONENTS = {
  GraphUp,
  GraphDown
};

type HistoryData = Array<{ date: string; [key: string]: number | string | null }>;

type Keys<Data extends HistoryData> = keyof Omit<Data[number], "date">;

export type TrendIndicatorProps<Field extends Keys<Data>, Data extends HistoryData = HistoryData> = {
  isFetching: boolean;
  data: Data;
  field: Field;
  components?: typeof COMPONENTS;
};

export const TrendIndicator = <Field extends string & Keys<Data>, Data extends HistoryData = HistoryData>({
  isFetching,
  data,
  field,
  components: { GraphUp, GraphDown } = COMPONENTS
}: TrendIndicatorProps<Field, Data>) => {
  const trendData = React.useMemo(() => {
    if (data.length < 2) return null;

    const sortedData = data.filter(item => typeof item[field] === "number");

    if (sortedData.length < 2) return null;

    const firstItem = sortedData[0];
    const lastItem = sortedData[sortedData.length - 1];

    const firstValue = firstItem[field];
    const lastValue = lastItem[field];

    if (typeof firstValue !== "number" || typeof lastValue !== "number") return null;
    if (firstValue === 0) return null;

    const percentageChange = ((lastValue - firstValue) / firstValue) * 100;
    const isCurrentDay = isToday(new Date(lastItem.date));

    return {
      change: Math.round(percentageChange * 100) / 100,
      period: isCurrentDay ? "today" : null
    };
  }, [data, field]);

  if (isFetching || !trendData || trendData.change === 0) return null;

  const isUp = trendData.change > 0;

  return (
    <p className="mt-2 text-gray-500">
      Trending {isUp ? "up" : "down"} by {Math.abs(trendData.change)}% {trendData.period && <span className="font-medium">{trendData.period}</span>}{" "}
      {isUp ? <GraphUp className="inline h-4 w-4" /> : <GraphDown className="inline h-4 w-4" />}
    </p>
  );
};
