import { Helmet } from "react-helmet-async";

import { BlocksTable } from "./BlocksTable";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";

export function BlocksPage() {
  return (
    <>
      <Helmet>
        <title>Blocks - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <Title className="mb-4">Blocks</Title>
        <BlocksTable />
      </PageContainer>
    </>
  );
}
