"use client";
import { Card, CardContent } from "@/components/ui/card";
import React, { useState } from "react";
import { useAddressTransactions } from "@/queries";
import Spinner from "@/components/Spinner";
import { SearchX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransactionRow } from "@/components/blockchain/TransactionRow";

interface IProps {
  address: string;
}

export function AddressTransactions({ address }: IProps) {
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const { data: transactionsResult, isLoading } = useAddressTransactions(address, (page - 1) * pageSize, pageSize);

  const pageCount = Math.ceil((transactionsResult?.count || 0) / pageSize);

  function handlePageChange(event: React.ChangeEvent<unknown>, value: number) {
    setPage(value);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {transactionsResult?.results.length === 0 ? (
          <div className="flex items-center p-4">
            <SearchX size="1rem" />
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

            <TableBody>{transactionsResult?.results.map(tx => <TransactionRow key={tx.hash} transaction={tx} blockHeight={tx.height} />)}</TableBody>
            {/* <TableBody>{deploymentsResult?.results.map(deployment => <DeploymentRow key={deployment.dseq} deployment={deployment} />)}</TableBody> */}
          </Table>
        )}
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <Spinner size="large" />
          </div>
        )}
        {/* {!!pageCount && (
          <div className={classes.pagerContainer}>
            <Pagination count={pageCount} page={page} onChange={handlePageChange} size="medium" />
          </div>
        )} */}
      </CardContent>
    </Card>
  );
}
