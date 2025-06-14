import type { FC } from "react";
import React from "react";
import { cn } from "@akashnetwork/ui/utils";
import { Chip } from "@mui/material";
import { capitalize } from "lodash";

export const AlertStatus: FC<{ status: string }> = ({ status }) => {
  return (
    <Chip
      label={capitalize(status)}
      className={cn(status === "OK" ? "bg-green-300 font-bold text-green-700" : "bg-red-200 font-bold text-red-700", "max-w-48")}
    />
  );
};
