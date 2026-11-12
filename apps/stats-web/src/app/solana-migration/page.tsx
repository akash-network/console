import type { Metadata } from "next";

import { SolanaMigrationContainer } from "./SolanaMigrationContainer";

import { PageContainer } from "@/components/PageContainer";

export const metadata: Metadata = {
  title: "Solana Migration Stats"
};

export default function SolanaMigrationPage() {
  return (
    <PageContainer>
      <SolanaMigrationContainer />
    </PageContainer>
  );
}
