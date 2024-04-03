import { Metadata, ResolvingMetadata } from "next";
import { ProviderDetail } from "./ProviderDetail";
import { getNetworkBaseApiUrl } from "@src/utils/constants";
import { ApiProviderDetail } from "@src/types/provider";
import { UrlService } from "@src/utils/urlUtils";

interface IProviderDetailPageProps {
  params: { owner: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata(
  { params: { owner }, searchParams: { network } }: IProviderDetailPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const response = await fetchProviderData(owner, network as string);
  const url = `https://deploy.cloudmos.io${UrlService.providerDetail(owner)}`;

  return {
    title: `Provider detail ${response?.name || response?.owner}`,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchProviderData(owner: string, network: string): Promise<ApiProviderDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/v1/providers/${owner}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching block data");
  }

  return response.json();
}

export async function ProviderDetailPage({ params: { owner }, searchParams: { network } }: IProviderDetailPageProps) {
  const provider = await fetchProviderData(owner, network as string);

  return <ProviderDetail owner={owner} _provider={provider} />;
}

export default ProviderDetailPage;
