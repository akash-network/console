"use client";
import { Metadata } from "next";

import { TransactionRow } from "@/components/blockchain/TransactionRow";
import Spinner from "@/components/Spinner";
import { Card, CardContent, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { useTransactions } from "@/queries";

export const metadata: Metadata = {
  title: "Blocks"
};

export const TransactionsTable: React.FunctionComponent = () => {
  const { data: transactions, isLoading } = useTransactions(20, {
    refetchInterval: 7000
  });

  return (
    <Card className="flex w-full flex-col justify-between">
      <CardContent>
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center pt-8">
              <Spinner size="large" />
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

              <TableBody>{transactions?.map(tx => <TransactionRow key={tx.hash} transaction={tx} blockHeight={tx.height} />)}</TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
