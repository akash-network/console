"use client";
import { Card, CardContent, Spinner, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import type { Metadata } from "next";

import { BlockRow } from "../../components/blockchain/BlockRow";

import { useBlocks } from "@/queries";

export const metadata: Metadata = {
  title: "Blocks"
};

export const BlocksTable: React.FunctionComponent = () => {
  const { data: blocks, isLoading } = useBlocks(20, {
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
                  <TableHead className="w-1/4 text-center">Height</TableHead>
                  <TableHead className="w-1/3 text-center">Proposer</TableHead>
                  <TableHead className="w-1/5 text-center">Transactions</TableHead>
                  <TableHead className="w-1/5 text-center">Time</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>{blocks?.map(block => <BlockRow key={block.height} block={block} />)}</TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
