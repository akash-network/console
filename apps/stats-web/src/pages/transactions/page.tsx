import { Helmet } from "react-helmet-async";

import { TransactionsTable } from "./TransactionsTable";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";

export function TransactionsPage() {
  return (
    <>
      <Helmet>
        <title>Transactions - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <Title className="mb-4">Transactions</Title>
        <TransactionsTable />
      </PageContainer>
    </>
  );
}
