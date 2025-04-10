import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import axios from "axios";
import type { GetServerSideProps } from "next";

import { ProviderDetail } from "@src/components/providers/ProviderDetail";
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

export const getServerSideProps: GetServerSideProps<Props, Pick<Props, "owner">> = async ({ params, query }) => {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(query.network as NetworkId);
  const response = await axios.get(`${apiUrl}/v1/providers/${params?.owner}`);

  return {
    props: {
      owner: params!.owner,
      _provider: response.data
    }
  };
};
