import type { Metadata } from "next";

import { BlocksTable } from "./BlocksTable";

import { PageContainer } from "@/components/PageContainer";

export const metadata: Metadata = {
  title: "Blocks"
};

const BlocksPage: React.FunctionComponent = () => {
  return (
    <PageContainer className="max-w-[1100px] pt-7">
      <BlocksTable />
    </PageContainer>
  );
};

export default BlocksPage;
