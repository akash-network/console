import { Alert, Spinner } from "@akashnetwork/ui/components";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";

import { DeploymentInfo } from "./DeploymentInfo";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { useDeployment } from "@/queries";
import type { DeploymentDetail } from "@/types";

export function DeploymentDetailPage() {
  const { address, dseq } = useParams<{ address: string; dseq: string }>();
  const { data: deployment, isLoading, error } = useDeployment(address || "", dseq || "");

  if (error) {
    return (
      <PageContainer>
        <Title className="mb-8">Deployment Details</Title>
        <Alert variant="destructive">Error loading deployment data. Please try again.</Alert>
      </PageContainer>
    );
  }

  return (
    <>
      <Helmet>
        <title>Deployment {address}/{dseq} - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <Title className="mb-8">Deployment Details</Title>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        )}

        {!isLoading && !deployment && (
          <div className="py-8 text-center text-muted-foreground">Deployment not found. Please check the address and dseq.</div>
        )}

        {deployment && <DeploymentInfo deployment={deployment} />}
      </PageContainer>
    </>
  );
}
