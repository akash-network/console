import React from "react";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { TransactionDetail } from "@/types";
import { getSplitText } from "@/hooks/useShortText";
import { Metadata, ResolvingMetadata } from "next";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionInfo } from "./TransactionInfo";
import { TxMessageRow } from "@/components/transactions/TxMessageRow";

interface IProps {
  params: { hash: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { hash } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
  const splittedTxHash = getSplitText(hash, 6, 6);
  return {
    title: `Tx ${splittedTxHash}`
  };
}

async function fetchTransactionData(hash: string, network: string): Promise<TransactionDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/transactions/${hash}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching block data");
  }

  return response.json();
}

export default async function TransactionDetailPage({ params: { hash }, searchParams: { network } }: IProps) {
  const transaction = await fetchTransactionData(hash, network as string);

  return (
    <PageContainer>
      <Title className="mb-4">Transaction Details</Title>

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
    </PageContainer>
  );
}
