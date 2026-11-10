import type { Metadata } from "next";

import { TransactionsTable } from "./TransactionsTable";

import { PageContainer } from "@/components/PageContainer";

export const metadata: Metadata = {
  title: "Transactions"
};

const TransactionsPage: React.FunctionComponent = () => {
  return (
    <PageContainer>
      <div className="mx-auto max-w-[1100px] pt-7">
        <TransactionsTable />
      </div>
    </PageContainer>
  );
};

export default TransactionsPage;
