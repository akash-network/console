import type { Network } from "@akashnetwork/network-store";
import type { Metadata } from "next";
import { z } from "zod";

import { ValidatorsInfo } from "./ValidatorInfo";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { networkId } from "@/config/env-config.schema";
import { UrlService } from "@/lib/urlUtils";
import { serverApiUrlService } from "@/services/api-url/server-api-url.service";
import type { ValidatorDetail } from "@/types";

const ValidatorDetailPageSchema = z.object({
  params: z.object({
    address: z.string()
  }),
  searchParams: z.object({
    network: networkId
  })
});
type ValidatorDetailPageProps = z.infer<typeof ValidatorDetailPageSchema>;

export async function generateMetadata({ params: { address }, searchParams: { network } }: ValidatorDetailPageProps): Promise<Metadata> {
  const url = `https://stats.akash.network${UrlService.validator(address)}`;
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
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

async function fetchValidatorData(address: string, network: Network["id"]): Promise<ValidatorDetail> {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
  const response = await fetch(`${apiUrl}/v1/validators/${address}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching validator data");
  }

  return response.json();
}

export default async function ValidatorDetailPage(props: ValidatorDetailPageProps) {
  const {
    params: { address },
    searchParams: { network }
  } = ValidatorDetailPageSchema.parse(props);
  const validator = await fetchValidatorData(address, network);

  return (
    <PageContainer>
      <Title>Validator Details</Title>

      <div className="mt-6">
        <ValidatorsInfo validator={validator} />
      </div>
    </PageContainer>
  );
}
