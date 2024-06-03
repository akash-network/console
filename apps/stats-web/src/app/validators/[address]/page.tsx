import { Metadata, ResolvingMetadata } from "next";

import { ValidatorsInfo } from "./ValidatorInfo";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { UrlService } from "@/lib/urlUtils";
import { ValidatorDetail } from "@/types";

interface IProps {
  params: { address: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { address }, searchParams: { network } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
  const url = `https://stats.akash.network${UrlService.validator(address)}`;
  const apiUrl = getNetworkBaseApiUrl(network as string);
  const response = await fetch(`${apiUrl}/v1/validators/${address}`);
  const data = (await response.json()) as ValidatorDetail;

  return {
    title: `Validator ${data.moniker}`,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchValidatorData(address: string, network: string): Promise<ValidatorDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/v1/validators/${address}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching validator data");
  }

  return response.json();
}

export default async function ValidatorDetailPage({ params: { address }, searchParams: { network } }: IProps) {
  const validator = await fetchValidatorData(address, network as string);

  return (
    <PageContainer>
      <Title>Validator Details</Title>

      <div className="mt-6">
        <ValidatorsInfo validator={validator} />
      </div>
    </PageContainer>
  );
}
