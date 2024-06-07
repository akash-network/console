"use client";
import { SearchX } from "lucide-react";
import Link from "next/link";

import { AKTAmount } from "@/components/AKTAmount";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getShortText } from "@/hooks/useShortText";
import { UrlService } from "@/lib/urlUtils";
import { IDelegationDetail } from "@/types";

type Props = {
  delegations: IDelegationDetail[];
};

export const Delegations: React.FunctionComponent<Props> = ({ delegations }) => {
  return (
    <div className="p-4">
      {delegations.length === 0 ? (
        <div className="flex items-center">
          <SearchX />
          &nbsp; No delegations
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Validator</TableHead>
              <TableHead align="right">Amount</TableHead>
              <TableHead align="right">Reward</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {delegations.map(delegation => (
              <TableRow key={delegation.validator.operatorAddress}>
                <TableCell>
                  <Link href={UrlService.validator(delegation.validator.operatorAddress)}>{getShortText(delegation.validator.moniker, 20)}</Link>
                </TableCell>
                <TableCell align="right">
                  <AKTAmount uakt={delegation.amount} showAKTLabel />
                </TableCell>
                <TableCell align="right">
                  <AKTAmount uakt={delegation.reward} showAKTLabel />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
