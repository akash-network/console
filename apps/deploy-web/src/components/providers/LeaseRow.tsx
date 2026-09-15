"use client";
import React from "react";
import { TableCell, TableRow } from "@akashnetwork/ui/components";
import isEqual from "lodash/isEqual";
import Link from "next/link";

import { PriceEstimateTooltip } from "@src/components/shared/PriceEstimateTooltip";
import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import { StatusPill } from "@src/components/shared/StatusPill";
import type { LeaseDto } from "@src/types/deployment";
import { uaktToAKT } from "@src/utils/priceUtils";
import { UrlService } from "@src/utils/urlUtils";

export type LeaseRowProps = {
  lease: LeaseDto;
  deploymentName: string | null;
};

const MemoLeaseRow: React.FunctionComponent<LeaseRowProps> = ({ lease, deploymentName }) => {
  return (
    <TableRow>
      <TableCell>
        <StatusPill state={lease.state} size="small" />
      </TableCell>
      <TableCell>
        <Link href={UrlService.deploymentDetails(lease.dseq)} passHref>
          {lease.dseq}
          {deploymentName && <span className="font-normal"> - {deploymentName}</span>}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex items-center">
          <PricePerTimeUnit
            denom={lease.price.denom}
            perBlockValue={uaktToAKT(parseFloat(lease.price.amount), 10)}
            showAsHourly={!!lease.gpuAmount && lease.gpuAmount > 0}
          />
          <PriceEstimateTooltip denom={lease.price.denom} value={lease.price.amount} showAsHourly={!!lease.gpuAmount && lease.gpuAmount > 0} />
        </div>
      </TableCell>
    </TableRow>
  );
};

export const LeaseRow = React.memo(MemoLeaseRow, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
