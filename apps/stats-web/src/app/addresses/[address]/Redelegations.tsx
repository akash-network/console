"use client";
import { FormattedRelativeTime } from "react-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { SearchX } from "lucide-react";
import Link from "next/link";

import { AKTAmount } from "@/components/AKTAmount";
import { getShortText } from "@/hooks/useShortText";
import { UrlService } from "@/lib/urlUtils";
import type { IRedelegationDetail } from "@/types";

type Props = {
  redelegations: IRedelegationDetail[];
};

export const Redelegations: React.FunctionComponent<Props> = ({ redelegations }) => {
  return (
    <div className="p-4">
      {redelegations.length === 0 ? (
        <div className="flex items-center">
          <SearchX />
          &nbsp; No redelegations
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead align="right">Amount</TableHead>
              <TableHead align="right">Time</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {redelegations.map(redelegation => (
              <TableRow key={`${redelegation.srcAddress.operatorAddress}_${redelegation.dstAddress.operatorAddress}`}>
                <TableCell>
                  <Link href={UrlService.validator(redelegation.srcAddress.operatorAddress)}>{getShortText(redelegation.srcAddress.moniker, 20)}</Link>
                </TableCell>
                <TableCell>
                  <Link href={UrlService.validator(redelegation.dstAddress.operatorAddress)}>{getShortText(redelegation.dstAddress.moniker, 20)}</Link>
                </TableCell>
                <TableCell align="right">
                  <AKTAmount uakt={redelegation.amount} showAKTLabel />
                </TableCell>
                <TableCell align="right">
                  <FormattedRelativeTime
                    value={(new Date(redelegation.completionTime).getTime() - new Date().getTime()) / 1000}
                    numeric="always"
                    unit="second"
                    style="narrow"
                    updateIntervalInSeconds={7}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
