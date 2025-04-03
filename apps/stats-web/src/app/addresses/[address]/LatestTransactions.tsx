"use client";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { SearchX } from "lucide-react";

import { TransactionRow } from "@/components/blockchain/TransactionRow";
import type { AddressDetail } from "@/types";

type Props = {
  addressDetail: AddressDetail;
};

export const LatestTransactions: React.FunctionComponent<Props> = ({ addressDetail }) => {
  return addressDetail.latestTransactions?.length === 0 ? (
    <div className="flex items-center p-4">
      <SearchX />
      &nbsp;This address has no transactions
    </div>
  ) : (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tx Hash</TableHead>
          <TableHead className="text-center">Type</TableHead>
          <TableHead className="text-center">Result</TableHead>
          <TableHead className="text-center">Amount</TableHead>
          <TableHead className="text-center">Fee</TableHead>
          <TableHead className="text-center">Height</TableHead>
          <TableHead className="text-center">Time</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>{addressDetail.latestTransactions?.map(tx => <TransactionRow key={tx.hash} transaction={tx} blockHeight={tx.height} />)}</TableBody>
    </Table>
  );
};
