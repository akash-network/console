import React from "react";
import type { Network } from "@akashnetwork/network-store";
import { Alert, Card, CardContent } from "@akashnetwork/ui/components";
import type { Metadata } from "next";
import { z } from "zod";

import { TransactionInfo } from "./TransactionInfo";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { TxMessageRow } from "@/components/transactions/TxMessageRow";
import { networkId } from "@/config/env-config.schema";
import { getSplitText } from "@/hooks/useShortText";
import { serverApiUrlService } from "@/services/api-url/server-api-url.service";
import { TransactionDetail } from "@/types";

const TransactionDetailPageSchema = z.object({
  params: z.object({
    hash: z.string()
  }),
  searchParams: z.object({
    network: networkId
  })
});
type TransactionDetailPageProps = z.infer<typeof TransactionDetailPageSchema>;

export async function generateMetadata({ params: { hash } }: TransactionDetailPageProps): Promise<Metadata> {
  const splitTxHash = getSplitText(hash, 6, 6);
  return {
    title: `Tx ${splitTxHash}`
  };
}

async function fetchTransactionData(hash: string, network: Network["id"]): Promise<TransactionDetail | null> {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
  const response = await fetch(`${apiUrl}/v1/transactions/${hash}`);
  if (!response.ok && response.status !== 404) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching transaction data");
  } else if (response.status === 404) {
    return null;
  }
  
  return response.json();
}

export default async function TransactionDetailPage(props: TransactionDetailPageProps) {
  const {
    params: { hash },
    searchParams: { network }
  } = TransactionDetailPageSchema.parse(props);
  const transaction = await fetchTransactionData(hash, network);
  return (
    <PageContainer>
      <Title className="mb-4">Transaction Details</Title>

      {transaction ? (
        <>
          <TransactionInfo transaction={transaction} />

          <div className="mt-6">
            <Title subTitle className="mb-4">
              Messages
            </Title>

            {transaction.messages.map(msg => (
              <Card key={msg.id} className="mb-2 p-0">
                <CardContent className="p-0">
                  <TxMessageRow message={msg} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Alert className="my-4">Transaction not found or indexed yet. Please wait a few seconds before refreshing.</Alert>
      )}
    </PageContainer>
  );
}
