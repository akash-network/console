import axios from "axios";

import { ProviderDetail } from "@src/components/providers/ProviderDetail";
import { ApiProviderDetail } from "@src/types/provider";
import { getNetworkBaseApiUrl } from "@src/utils/constants";

type Props = {
  owner: string;
  _provider: ApiProviderDetail;
};

const ProviderDetailPage: React.FunctionComponent<Props> = ({ owner, _provider }) => {
  return <ProviderDetail owner={owner} _provider={_provider} />;
};

export default ProviderDetailPage;

export async function getServerSideProps({ params, query }) {
  const apiUrl = getNetworkBaseApiUrl(query.network as string);
  const response = await axios.get(`${apiUrl}/v1/providers/${params?.owner}`);

  return {
    props: {
      owner: params?.owner,
      _provider: response.data
    }
  };
}
