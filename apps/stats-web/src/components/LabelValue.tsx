"use client";
import { cn } from "@/lib/utils";

type LabelValueProps = {
  label: any;
  value?: any;
  labelWidth?: string | number;
  className?: string;

  // All other props
  [x: string]: any;
};

export const LabelValue: React.FunctionComponent<LabelValueProps> = ({ label, value, labelWidth = "15rem", className = "", ...rest }) => {
  return (
    <div className={cn(className, "mb-4 flex flex-col items-start last:mb-0 sm:flex-row sm:items-center")} {...rest}>
      <div className="text-muted-foreground flex shrink-0 items-center break-all pr-2 font-bold" style={{ width: labelWidth }}>
        {label}
      </div>
      {value !== undefined && <div className="w-full flex-grow break-all [overflow-wrap:anywhere] sm:w-auto">{value}</div>}
    </div>
  );
};
