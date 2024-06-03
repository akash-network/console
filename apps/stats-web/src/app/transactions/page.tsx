import { Metadata } from "next";

import { TransactionsTable } from "./TransactionsTable";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";

type Props = {};

export const metadata: Metadata = {
  title: "Transactions"
};

const TransactionsPage: React.FunctionComponent<Props> = ({}) => {
  return (
    <PageContainer>
      <Title className="mb-4">Transactions</Title>

      <TransactionsTable />
    </PageContainer>
  );
};

export default TransactionsPage;
