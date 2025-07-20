import React from "react";
import { differenceInDays, endOfMonth, endOfWeek, isThisMonth, isThisWeek, isToday, startOfMonth, startOfWeek, subDays } from "date-fns";
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

    const sortedData = data
      .filter(item => item[field] !== undefined && item[field] !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sortedData.length < 2) return null;

    const firstDate = new Date(sortedData[0].date);
    const lastDate = new Date(sortedData[sortedData.length - 1].date);
    const dataSpanDays = differenceInDays(lastDate, firstDate);

    if (dataSpanDays <= 7) {
      const lastDayData = sortedData[sortedData.length - 1];
      const previousDayData = sortedData[sortedData.length - 2];

      const lastValue = lastDayData[field];
      const previousValue = previousDayData[field];

      if (typeof lastValue !== "number" || typeof previousValue !== "number") return null;

      const percentageChange = ((lastValue - previousValue) / previousValue) * 100;
      const isCurrentDay = isToday(new Date(lastDayData.date));

      return {
        change: Math.round(percentageChange * 100) / 100,
        period: isCurrentDay ? "today" : null
      };
    }

    if (dataSpanDays <= 30) {
      const latestWeekStart = startOfWeek(lastDate, { weekStartsOn: 1 });
      const latestWeekEnd = endOfWeek(lastDate, { weekStartsOn: 1 });

      const previousWeekStart = startOfWeek(subDays(latestWeekStart, 1), { weekStartsOn: 1 });
      const previousWeekEnd = endOfWeek(subDays(latestWeekStart, 1), { weekStartsOn: 1 });

      const latestWeekData = sortedData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= latestWeekStart && itemDate <= latestWeekEnd;
      });

      const previousWeekData = sortedData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= previousWeekStart && itemDate <= previousWeekEnd;
      });

      if (latestWeekData.length === 0 || previousWeekData.length === 0) return null;

      const latestWeekSum = latestWeekData.reduce((sum, item) => {
        const value = item[field];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);

      const previousWeekSum = previousWeekData.reduce((sum, item) => {
        const value = item[field];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);

      if (previousWeekSum === 0) return null;

      const percentageChange = ((latestWeekSum - previousWeekSum) / previousWeekSum) * 100;
      const isCurrentWeek = isThisWeek(lastDate, { weekStartsOn: 1 });

      return {
        change: Math.round(percentageChange * 100) / 100,
        period: isCurrentWeek ? "this week" : null
      };
    }

    const latestMonth = lastDate;
    const latestMonthStart = startOfMonth(latestMonth);
    const latestMonthEnd = endOfMonth(latestMonth);

    const previousMonth = subDays(latestMonthStart, 1);
    const previousMonthStart = startOfMonth(previousMonth);
    const previousMonthEnd = endOfMonth(previousMonth);

    const latestMonthData = sortedData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= latestMonthStart && itemDate <= latestMonthEnd;
    });

    const previousMonthData = sortedData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= previousMonthStart && itemDate <= previousMonthEnd;
    });

    if (latestMonthData.length === 0 || previousMonthData.length === 0) return null;

    const latestMonthSum = latestMonthData.reduce((sum, item) => {
      const value = item[field];
      return sum + (typeof value === "number" ? value : 0);
    }, 0);

    const previousMonthSum = previousMonthData.reduce((sum, item) => {
      const value = item[field];
      return sum + (typeof value === "number" ? value : 0);
    }, 0);

    if (previousMonthSum === 0) return null;

    const percentageChange = ((latestMonthSum - previousMonthSum) / previousMonthSum) * 100;
    const isCurrentMonth = isThisMonth(lastDate);

    return {
      change: Math.round(percentageChange * 100) / 100,
      period: isCurrentMonth ? "this month" : null
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
