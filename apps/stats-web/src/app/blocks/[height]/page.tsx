import { LoggerService } from "@akashnetwork/logging";
import type { Network } from "@akashnetwork/network-store";
import { Card, CardContent, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";

import { BlockInfo } from "./BlockInfo";

import { TransactionRow } from "@/components/blockchain/TransactionRow";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { networkId } from "@/config/env-config.schema";
import { serverFetch } from "@/lib/serverFetch";
import { serverApiUrlService } from "@/services/api-url/server-api-url.service";
import type { BlockDetail } from "@/types";

const logger = new LoggerService({ context: "BlockDetailPage" });

const BlockDetailPageSchema = z.object({
  params: z.object({
    height: z.string()
  }),
  searchParams: z.object({
    network: networkId
  })
});
type BlockDetailPageProps = z.infer<typeof BlockDetailPageSchema>;

export async function generateMetadata({ params: { height } }: BlockDetailPageProps): Promise<Metadata> {
  return {
    title: `Block #${height}`
  };
}

async function fetchBlockData(height: string, network: Network["id"]): Promise<BlockDetail | null> {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
  const response = await serverFetch(`${apiUrl}/v1/blocks/${height}`);

  if (!response.ok && response.status !== 404) {
    logger.error({ event: "BLOCK_FETCH_ERROR", height, network, status: response.status });
    throw new Error(`Error fetching block data: ${height}`);
  } else if (response.status === 404) {
    logger.debug({ event: "BLOCK_NOT_FOUND", height, network });
    return null;
  }

  return response.json();
}

export default async function BlockDetailPage(props: BlockDetailPageProps) {
  const {
    params: { height },
    searchParams: { network }
  } = BlockDetailPageSchema.parse(props);
  const block = await fetchBlockData(height, network);

  if (!block) {
    return (
      <PageContainer>
        <Title className="mb-4">Details for Block #{height}</Title>
        <div className="py-8 text-center text-muted-foreground">Block not found or not indexed yet. Please check the block height and try again.</div>
      </PageContainer>
    );
  }

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
