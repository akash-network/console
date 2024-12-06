import { useMemo } from "react";
import { Card, CardContent, Tooltip, TooltipContent, TooltipTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

interface PercentChangeProps {
  currentPrice: number | null;
  previousPrice: number | null;
}

interface FinanceCardProps {
  title: string;
  subtitle: string;
  currentPrice: number | null;
  previousPrice: number | null;
  message: string | null;
}

const PercentChange: React.FC<PercentChangeProps> = ({ currentPrice, previousPrice }) => {
  const { percentageChange, formattedChange } = useMemo(() => {
    if (currentPrice === null || previousPrice === null || previousPrice === 0) {
      return { percentageChange: 0, formattedChange: "0" };
    }

    const percentageChange = ((currentPrice - previousPrice) / previousPrice) * 100;
    const formattedChange = Math.abs(percentageChange).toFixed(2);

    return { percentageChange, formattedChange };
  }, [currentPrice, previousPrice]);

  const isZero = currentPrice === null || previousPrice === null || previousPrice === 0 || percentageChange === 0;
  console.log(isZero);
  const value = percentageChange !== 0 ? `${formattedChange}%` : "";
  const prefix = !isZero && percentageChange > 0 ? "+" : "-";

  return (
    <span className={cn({ "text-gray-500": isZero, "text-green-500": percentageChange > 0, "text-red-500": percentageChange < 0 })}>
      {prefix}
      {value}
    </span>
  );
};

export const FinanceCard: React.FC<FinanceCardProps> = ({ title, subtitle, currentPrice, previousPrice, message }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="">
            <div className="text-sm font-medium">{subtitle}</div>
            <div className="text-2xl font-semibold">{title}</div>
            <div className="mt-1 text-sm font-medium">
              <Tooltip>
                <TooltipTrigger>
                  <PercentChange currentPrice={currentPrice} previousPrice={previousPrice} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{message}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-end">
            <div className="w-full overflow-hidden">{/* implement graph once apis available */}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
