"use client";

import { cn } from "@src/utils/styleUtils";

type LabelValueProps = {
  label?: string | React.ReactNode;
  value?: string | React.ReactNode;
  labelWidth?: string | number;
  className?: string;
};

export const LabelValue: React.FunctionComponent<LabelValueProps> = ({ label, value, labelWidth = "15rem", className = "" }) => {
  return (
    <div className={cn(className, "mb-4 flex flex-col items-start last:mb-0 sm:flex-row sm:items-center")}>
      {label && (
        <div className="flex shrink-0 items-center break-all pr-2 font-bold text-muted-foreground" style={{ width: labelWidth }}>
          {label}
        </div>
      )}
      {value !== undefined && <div className="w-full flex-grow break-all [overflow-wrap:anywhere] sm:w-auto">{value}</div>}
    </div>
  );
};
