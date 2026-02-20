import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { Alert, Card, CardContent, Spinner, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { SearchX } from "lucide-react";

import { BlockInfo } from "./BlockInfo";

import { TransactionRow } from "@/components/blockchain/TransactionRow";
import { PageContainer } from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { useBlock } from "@/queries";

export function BlockDetailPage() {
  const { height } = useParams<{ height: string }>();
  const { data: block, isLoading, error } = useBlock(height || "");

  if (error) {
    return (
      <PageContainer>
        <Title className="mb-4">Details for Block #{height}</Title>
        <Alert variant="destructive">Error loading block data. Please try again.</Alert>
      </PageContainer>
    );
  }

  return (
    <>
      <Helmet>
        <title>Block #{height} - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <Title className="mb-4">Details for Block #{height}</Title>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        )}

        {!isLoading && !block && (
          <div className="py-8 text-center text-muted-foreground">Block not found or not indexed yet. Please check the block height and try again.</div>
        )}

        {block && (
          <>
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
          </>
        )}
      </PageContainer>
    </>
  );
}
