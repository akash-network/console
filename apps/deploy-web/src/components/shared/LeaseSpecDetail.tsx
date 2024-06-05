"use client";
import React from "react";
import { MdDeveloperBoard, MdMemory, MdSpeed, MdStorage } from "react-icons/md";
import { FormattedNumber } from "react-intl";

import { cn } from "@src/utils/styleUtils";

type SpecType = "cpu" | "gpu" | "ram" | "storage";
type Props = {
  type: SpecType;
  value: number | string;
  className?: string;
  iconSize?: "small" | "medium" | "large";
};

export const LeaseSpecDetail: React.FunctionComponent<Props> = ({ value, type, className, iconSize = "large" }) => {
  return (
    <div className={cn("flex items-center", className)}>
      <div className="text-muted-foreground">
        {type === "cpu" && <MdSpeed fontSize={iconSize} />}
        {type === "gpu" && <MdDeveloperBoard fontSize={iconSize} />}
        {type === "ram" && <MdMemory fontSize={iconSize} />}
        {type === "storage" && <MdStorage fontSize={iconSize} />}
      </div>

      <div className="ml-1">{typeof value === "string" ? value : <FormattedNumber value={value} />}</div>
      <div className="ml-1 text-muted-foreground">
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
