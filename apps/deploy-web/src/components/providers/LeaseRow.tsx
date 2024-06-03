"use client";
import React from "react";
import isEqual from "lodash/isEqual";
import Link from "next/link";

import { PriceEstimateTooltip } from "@src/components/shared/PriceEstimateTooltip";
import { PricePerMonth } from "@src/components/shared/PricePerMonth";
import { StatusPill } from "@src/components/shared/StatusPill";
import { TableCell, TableRow } from "@src/components/ui/table";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { LeaseDto } from "@src/types/deployment";
import { uaktToAKT } from "@src/utils/priceUtils";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  lease: LeaseDto;
};

const MemoLeaseRow: React.FunctionComponent<Props> = ({ lease }) => {
  const { getDeploymentName } = useLocalNotes();
  const deploymentName = getDeploymentName(lease.dseq);

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
          <PricePerMonth denom={lease.price.denom} perBlockValue={uaktToAKT(parseFloat(lease.price.amount), 10)} />
          <PriceEstimateTooltip denom={lease.price.denom} value={lease.price.amount} />
        </div>
      </TableCell>
    </TableRow>
  );
};

export const LeaseRow = React.memo(MemoLeaseRow, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
