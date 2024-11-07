"use client";
import { useIntl } from "react-intl";
import { cn } from "@akashnetwork/ui/utils";

type Props = {
  value: number;
};
export const Uptime: React.FunctionComponent<Props> = ({ value }) => {
  const intl = useIntl();

  return (
    <span className={cn({ ["text-green-600"]: value > 0.95, ["text-orange-600"]: value < 0.95 })}>
      {intl.formatNumber(value, { style: "percent", maximumFractionDigits: 2 })}
    </span>
  );
};
