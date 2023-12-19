"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { cn } from "@/lib/utils";
import { MdMemory, MdStorage, MdSpeed, MdDeveloperBoard } from "react-icons/md";

type SpecType = "cpu" | "gpu" | "ram" | "storage";
type Props = {
  type: SpecType;
  value: number | string;
  className?: string;
  iconSize?: "small" | "medium" | "large";
};

export const LeaseSpecDetail: React.FunctionComponent<Props> = ({ value, type, className, iconSize = "large" }) => {
  return (
    <div className={cn("mb-1 flex items-center", className)}>
      {type === "cpu" && (
        <div className="text-muted-foreground">
          <MdSpeed fontSize={iconSize} />
        </div>
      )}
      {type === "gpu" && <MdDeveloperBoard fontSize={iconSize} />}
      {type === "ram" && <MdMemory fontSize={iconSize} />}
      {type === "storage" && <MdStorage fontSize={iconSize} />}

      <div className="ml-2">{typeof value === "string" ? value : <FormattedNumber value={value} />}</div>
      <div className="ml-2 text-muted-foreground">
        <span className="text-xs text-muted-foreground">
          {type === "cpu" && "CPU"}
          {type === "gpu" && "GPU"}
          {type === "ram" && "RAM"}
          {type === "storage" && "Disk"}
        </span>
      </div>
    </div>
  );
};
