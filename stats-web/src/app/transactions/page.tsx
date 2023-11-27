import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { Metadata } from "next";
import { TransactionsTable } from "./TransactionsTable";

type Props = {};

export const metadata: Metadata = {
  title: "Transasctions"
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
