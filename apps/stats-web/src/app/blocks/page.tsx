import type { Metadata } from "next";

import { BlocksTable } from "./BlocksTable";

import { PageContainer } from "@/components/PageContainer";

export const metadata: Metadata = {
  title: "Blocks"
};

const BlocksPage: React.FunctionComponent = () => {
  return (
    <PageContainer>
      <div className="mx-auto max-w-[1100px] pt-7">
        <BlocksTable />
      </div>
    </PageContainer>
  );
};

export default BlocksPage;
