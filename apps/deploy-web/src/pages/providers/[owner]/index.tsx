import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";

import { ProviderDetail } from "@src/components/providers/ProviderDetail";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { serverApiUrlService } from "@src/services/api-url/server-api-url.service";
import type { ApiProviderDetail } from "@src/types/provider";

type Props = {
  owner: string;
  _provider: ApiProviderDetail;
};

const ProviderDetailPage: React.FunctionComponent<Props> = ({ owner, _provider }) => {
  return <ProviderDetail owner={owner} _provider={_provider} />;
};

export default ProviderDetailPage;

export const getServerSideProps = getServerSidePropsWithServices<Props>(async ({ params, query, services }) => {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(query.network as NetworkId);
  const response = await services.axios.get(`${apiUrl}/v1/providers/${params?.owner}`);

  return {
    props: {
      owner: params!.owner as string,
      _provider: response.data
    }
  };
});
