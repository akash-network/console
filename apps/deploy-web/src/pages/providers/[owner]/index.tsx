import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import { netConfig } from "@akashnetwork/net";
import type { GetServerSidePropsResult } from "next";
import { z } from "zod";

import { ProviderDetail } from "@src/components/providers/ProviderDetail";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { ApiProviderDetail } from "@src/types/provider";

type Props = {
  owner: string;
  _provider: ApiProviderDetail;
};

const ProviderDetailPage: React.FunctionComponent<Props> = ({ owner, _provider }) => {
  return <ProviderDetail owner={owner} _provider={_provider} />;
};

export default ProviderDetailPage;

export const getServerSideProps = defineServerSideProps({
  route: "/providers/[owner]",
  schema: z.object({
    params: z.object({
      owner: z.string()
    }),
    query: z.object({
      network: z.enum(netConfig.getSupportedNetworks() as [NetworkId, ...NetworkId[]]).optional()
    })
  }),
  async handler({ params, query, services }): Promise<GetServerSidePropsResult<Props>> {
    const apiUrl = services.apiUrlService.getBaseApiUrlFor(query.network);
    const response = await services.axios.get(`${apiUrl}/v1/providers/${params.owner}`);

    return {
      props: {
        owner: params.owner,
        _provider: response.data
      }
    };
  }
});
