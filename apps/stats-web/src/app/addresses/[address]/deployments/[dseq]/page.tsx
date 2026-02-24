import type { Network } from "@akashnetwork/network-store";
import type { Metadata } from "next";
import { z } from "zod";

import { DeploymentInfo } from "./DeploymentInfo";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { networkId } from "@/config/env-config.schema";
import { createLogger } from "@/lib/createLogger/createLogger";
import { serverFetch } from "@/lib/serverFetch";
import { UrlService } from "@/lib/urlUtils";
import { serverApiUrlService } from "@/services/api-url/server-api-url.service";
import type { DeploymentDetail } from "@/types";

const logger = createLogger({ context: "DeploymentDetailPage" });

const DeploymentDetailPageSchema = z.object({
  params: z.object({
    address: z.string(),
    dseq: z.string()
  }),
  searchParams: z.object({
    network: networkId
  })
});
type DeploymentDetailPageProps = z.infer<typeof DeploymentDetailPageSchema>;

export async function generateMetadata({ params: { address, dseq } }: DeploymentDetailPageProps): Promise<Metadata> {
  const url = `https://stats.akash.network${UrlService.deployment(address, dseq)}`;

  return {
    title: `Deployment ${address}/${dseq}`,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchDeploymentData(address: string, dseq: string, network: Network["id"]): Promise<DeploymentDetail | null> {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
  const response = await serverFetch(`${apiUrl}/v1/deployment/${address}/${dseq}`);

  if (!response.ok && response.status !== 404) {
    logger.error({ event: "DEPLOYMENT_FETCH_ERROR", address, dseq, network, status: response.status });
    throw new Error(`Error fetching deployment data: ${address}/${dseq}`);
  } else if (response.status === 404) {
    return null;
  }

  return response.json();
}

export default async function DeploymentDetailPage(props: DeploymentDetailPageProps) {
  const {
    params: { address, dseq },
    searchParams: { network }
  } = DeploymentDetailPageSchema.parse(props);
  const deployment = await fetchDeploymentData(address, dseq, network);

  if (!deployment) {
    return (
      <PageContainer>
        <Title className="mb-8">Deployment Details</Title>
        <div className="py-8 text-center text-muted-foreground">Deployment not found or not indexed yet. Please check the address and dseq and try again.</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Title className="mb-8">Deployment Details</Title>

      <DeploymentInfo deployment={deployment} />
    </PageContainer>
  );
}
