import React from "react";
import { Alert, Card, CardContent } from "@akashnetwork/ui/components";
import { Metadata } from "next";

import { TransactionInfo } from "./TransactionInfo";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { TxMessageRow } from "@/components/transactions/TxMessageRow";
import { getSplitText } from "@/hooks/useShortText";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { TransactionDetail } from "@/types";

interface IProps {
  params: { hash: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { hash } }: IProps): Promise<Metadata> {
  const splittedTxHash = getSplitText(hash, 6, 6);
  return {
    title: `Tx ${splittedTxHash}`
  };
}

async function fetchTransactionData(hash: string, network: string): Promise<TransactionDetail | null> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/v1/transactions/${hash}`);

  if (!response.ok && response.status !== 404) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching transction data");
  } else if (response.status === 404) {
    return null;
  }

  return response.json();
}

export default async function TransactionDetailPage({ params: { hash }, searchParams: { network } }: IProps) {
  const transaction = await fetchTransactionData(hash, network as string);

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
