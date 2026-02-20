import { Helmet } from "react-helmet-async";

import { DashboardContainer } from "./DashboardContainer";

import { PageContainer } from "@/components/PageContainer";

export function HomePage() {
  return (
    <>
      <Helmet>
        <title>Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <DashboardContainer />
      </PageContainer>
    </>
  );
}
