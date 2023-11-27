import { BlockDetail } from "@/types";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { Metadata, ResolvingMetadata } from "next";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { SearchX } from "lucide-react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransactionRow } from "@/components/blockchain/TransactionRow";
import { BlockInfo } from "./BlockInfo";
import { Card, CardContent } from "@/components/ui/card";

interface IProps {
  params: { height: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { height } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
  return {
    title: `Block #${height}`
  };
}

async function fetchBlockData(height: string, network: string): Promise<BlockDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/blocks/${height}`);

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
                &nbsp; No transactions
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
