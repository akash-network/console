import type { GetServerSidePropsResult } from "next";
import { z } from "zod";

import { loadProviderDetail } from "@src/components/providers/ProviderProfile/loadProviderDetail";
import { ProviderProfile } from "@src/components/providers/ProviderProfile/ProviderProfile";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { ApiProviderDetail } from "@src/types/provider";

type Props = {
  owner: string;
  _provider: ApiProviderDetail;
};

const ProviderDetailPage: React.FunctionComponent<Props> = ({ owner, _provider }) => {
  return <ProviderProfile owner={owner} initialProvider={_provider} />;
};

export default ProviderDetailPage;

export const getServerSideProps = defineServerSideProps({
  route: "/providers/[owner]",
  schema: z.object({
    params: z.object({
      owner: z.string()
    }),
    query: z.object({
      network: z.enum(["mainnet", "sandbox", "testnet"]).optional()
    })
  }),
  async handler({ params, query, services }): Promise<GetServerSidePropsResult<Props>> {
    const apiUrl = services.apiUrlService.getBaseApiUrlFor(query.network);
    const provider = await loadProviderDetail(services.consoleApiHttpClient, apiUrl, params.owner);

    if (!provider) {
      return { notFound: true };
    }

    return {
      props: {
        owner: params.owner,
        _provider: provider
      }
    };
  }
});
