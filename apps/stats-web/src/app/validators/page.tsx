import { Metadata } from "next";

import { ValidatorsTable } from "./ValidatorsTable";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";

export const metadata: Metadata = {
  title: "Validators"
};

export default async function ValidatorsPage() {
  return (
    <PageContainer>
      <Title className="mb-4">Validators</Title>

      <ValidatorsTable />
    </PageContainer>
  );
}
