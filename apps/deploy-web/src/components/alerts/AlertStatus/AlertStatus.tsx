import type { FC } from "react";
import React from "react";
import { capitalize } from "lodash";

export const AlertStatus: FC<{ status: string }> = ({ status }) => {
  return (
    <span
      data-status={status}
      className="inline-flex rounded-full bg-muted px-2.5 py-[3px] text-xs font-semibold text-muted-foreground data-[status=OK]:bg-success/15 data-[status=TRIGGERED]:bg-destructive/15 data-[status=OK]:text-success data-[status=TRIGGERED]:text-destructive"
    >
      {capitalize(status)}
    </span>
  );
};
