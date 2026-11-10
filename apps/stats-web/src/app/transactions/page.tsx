import type { Metadata } from "next";

import { TransactionsTable } from "./TransactionsTable";

import { PageContainer } from "@/components/PageContainer";

export const metadata: Metadata = {
  title: "Transactions"
};

const TransactionsPage: React.FunctionComponent = () => {
  return (
    <PageContainer className="max-w-[1100px] pt-7">
      <TransactionsTable />
    </PageContainer>
  );
};

export default TransactionsPage;
