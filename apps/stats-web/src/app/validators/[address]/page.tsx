import type { Network } from "@akashnetwork/network-store";
import type { Metadata } from "next";
import { z } from "zod";

import { ValidatorsInfo } from "./ValidatorInfo";

import { PageContainer } from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { networkId } from "@/config/env-config.schema";
import { serverFetch } from "@/lib/serverFetch";
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
type ParsedValidatorDetailProps = z.infer<typeof ValidatorDetailPageSchema>;
type ValidatorDetailPageProps = {
  params: Promise<ParsedValidatorDetailProps["params"]>;
  searchParams: Promise<ParsedValidatorDetailProps["searchParams"]>;
};

export async function generateMetadata({ params, searchParams }: ValidatorDetailPageProps): Promise<Metadata> {
  const [{ address }, { network }] = await Promise.all([params, searchParams]);
  const url = `https://stats.akash.network${UrlService.validator(address)}`;
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
  const response = await serverFetch(`${apiUrl}/v1/validators/${address}`);
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
  const response = await serverFetch(`${apiUrl}/v1/validators/${address}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching validator data");
  }

  return response.json();
}

export default async function ValidatorDetailPage(props: ValidatorDetailPageProps) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const {
    params: { address },
    searchParams: { network }
  } = ValidatorDetailPageSchema.parse({ params, searchParams });
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
