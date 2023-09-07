export type GithubChainRegistryAssetListResponse = {
  $schema: string;
  chain_name: string;
  assets: {
    description: string;
    denom_units: {
      denom: string;
      exponent: number;
    }[];
    base: string;
    name: string;
    display: string;
    symbol: string;
    logo_URIs: {
      png: string;
      svg: string;
    };
    coingecko_id: string;
  }[];
};
