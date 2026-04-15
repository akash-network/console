import type { Metadata } from "next";

import { BmeDashboardContainer } from "./BmeDashboardContainer";

import { PageContainer } from "@/components/PageContainer";

export const metadata: Metadata = {
  title: "BME Stats"
};

export default function BmePage() {
  return (
    <PageContainer>
      <BmeDashboardContainer />
    </PageContainer>
  );
}
