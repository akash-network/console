"use client";
import { cn } from "@src/utils/styleUtils";
import { useIntl } from "react-intl";

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
