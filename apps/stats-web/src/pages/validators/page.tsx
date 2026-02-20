import { Helmet } from "react-helmet-async";

import { ValidatorsTable } from "./ValidatorsTable";

import { PageContainer } from "@/components/PageContainer";
import { Title } from "@/components/Title";

export function ValidatorsPage() {
  return (
    <>
      <Helmet>
        <title>Validators - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <Title className="mb-4">Validators</Title>
        <ValidatorsTable />
      </PageContainer>
    </>
  );
}
