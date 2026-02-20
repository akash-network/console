import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { Alert, Card, CardContent, Spinner } from "@akashnetwork/ui/components";

import { TransactionInfo } from "./TransactionInfo";

import { PageContainer } from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { TxMessageRow } from "@/components/transactions/TxMessageRow";
import { getSplitText } from "@/hooks/useShortText";
import { useTransaction } from "@/queries";

export function TransactionDetailPage() {
  const { hash } = useParams<{ hash: string }>();
  const { data: transaction, isLoading, error } = useTransaction(hash || "");
  const splitTxHash = getSplitText(hash || "", 6, 6);

  if (error) {
    return (
      <PageContainer>
        <Title className="mb-4">Transaction Details</Title>
        <Alert variant="destructive">Error loading transaction data. Please try again.</Alert>
      </PageContainer>
    );
  }

  return (
    <>
      <Helmet>
        <title>Tx {splitTxHash} - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <Title className="mb-4">Transaction Details</Title>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        )}

        {!isLoading && !transaction && (
          <Alert className="my-4">Transaction not found or indexed yet. Please wait a few seconds before refreshing.</Alert>
        )}

        {transaction && (
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
        )}
      </PageContainer>
    </>
  );
}
