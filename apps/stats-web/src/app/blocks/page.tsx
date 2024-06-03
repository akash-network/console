import { Metadata } from "next";

import { BlocksTable } from "./BlocksTable";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";

type Props = {};

export const metadata: Metadata = {
  title: "Blocks"
};

const BlocksPage: React.FunctionComponent<Props> = ({}) => {
  return (
    <PageContainer>
      <Title className="mb-4">Blocks</Title>

      <BlocksTable />
    </PageContainer>
  );
};

export default BlocksPage;
