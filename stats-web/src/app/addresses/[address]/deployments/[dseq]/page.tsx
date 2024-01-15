import { Metadata, ResolvingMetadata } from "next";
import { UrlService } from "@/lib/urlUtils";
import PageContainer from "@/components/PageContainer";
import { DeploymentInfo } from "./DeploymentInfo";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { DeploymentDetail } from "@/types";
import { Title } from "@/components/Title";

interface IProps {
  params: { address: string; dseq: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { address, dseq } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
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

async function fetchDeploymentData(address: string, dseq: string, network: string): Promise<DeploymentDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/deployment/${address}/${dseq}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching address data");
  }

  return response.json();
}

export default async function DeploymentDetailPage({ params: { address, dseq }, searchParams: { network } }: IProps) {
  const deployment = await fetchDeploymentData(address, dseq, network as string);

  return (
    <PageContainer>
      <Title className="mb-8">Deployment Details</Title>

      <DeploymentInfo deployment={deployment} />
    </PageContainer>
  );
}