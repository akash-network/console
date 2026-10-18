import { cache } from "react";
import type { Network } from "@akashnetwork/network-store";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ValidatorsInfo } from "./ValidatorInfo";

import { PageContainer } from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { serverEnvConfig } from "@/config/server-env.config";
import { createNetworkSearchParamsSchema } from "@/lib/networkSearchParams/networkSearchParams";
import { notFoundOnMalformedId } from "@/lib/notFoundOnMalformedId/notFoundOnMalformedId";
import { serverFetch } from "@/lib/serverFetch";
import { UrlService } from "@/lib/urlUtils";
import { serverApiUrlService } from "@/services/api-url/server-api-url.service";
import type { ValidatorDetail } from "@/types";

const ValidatorDetailPageSchema = z.object({
  params: z.object({
    address: z.string()
  }),
  searchParams: createNetworkSearchParamsSchema(serverEnvConfig.NEXT_PUBLIC_DEFAULT_NETWORK_ID)
});
type ParsedValidatorDetailProps = z.infer<typeof ValidatorDetailPageSchema>;
type ValidatorDetailPageProps = {
  params: Promise<ParsedValidatorDetailProps["params"]>;
  searchParams: Promise<ParsedValidatorDetailProps["searchParams"]>;
};

/** serverFetch passes an abort signal, which opts it out of Next's fetch memoization, so metadata and page share this cache instead. */
const fetchValidatorData = cache(async (address: string, network: Network["id"]): Promise<ValidatorDetail> => {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
  const response = await serverFetch(`${apiUrl}/v1/validators/${address}`);

  notFoundOnMalformedId(response);

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching validator data");
  }

  return response.json();
});

export async function generateMetadata(props: ValidatorDetailPageProps): Promise<Metadata> {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const {
    params: { address },
    searchParams: { network }
  } = ValidatorDetailPageSchema.parse({ params, searchParams });
  const url = `https://stats.akash.network${UrlService.validator(address)}`;
  const validator = await fetchValidatorData(address, network);

  return {
    title: `Validator ${validator.moniker}`,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
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
