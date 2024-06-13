import { SearchX } from "lucide-react";
import { Metadata } from "next";

import { BlockInfo } from "./BlockInfo";

import { TransactionRow } from "@/components/blockchain/TransactionRow";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { Card, CardContent } from "@akashnetwork/ui/components";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { BlockDetail } from "@/types";

interface IProps {
  params: { height: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { height } }: IProps): Promise<Metadata> {
  return {
    title: `Block #${height}`
  };
}

async function fetchBlockData(height: string, network: string): Promise<BlockDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/v1/blocks/${height}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching block data");
  }

  return response.json();
}

export default async function BlockDetailPage({ params: { height }, searchParams: { network } }: IProps) {
  const block = await fetchBlockData(height, network as string);

  return (
    <PageContainer>
      <Title className="mb-4">Details for Block #{height}</Title>

      <BlockInfo block={block} />

      <div className="mt-6">
        <Title subTitle className="mb-4">
          Transactions
        </Title>

        <Card>
          <CardContent className="pt-6">
            {block.transactions.length === 0 ? (
              <div className="flex items-center p-4">
                <SearchX size="1rem" />
                &nbsp;No transactions
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

                <TableBody>
                  {block.transactions.map(transaction => (
                    <TransactionRow key={transaction.hash} transaction={transaction} blockHeight={block.height} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
