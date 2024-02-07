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

export type GithubChainRegistryChainResponse = {
  $schema: string;
  chain_name: string;
  status: string;
  network_type: string;
  website: string;
  pretty_name: string;
  chain_id: string;
  bech32_prefix: string;
  daemon_name: string;
  node_home: string;
  slip44: number;
  fees: {
    fee_tokens: {
      denom: string;
      fixed_min_gas_price: number;
      low_gas_price: number;
      average_gas_price: number;
      high_gas_price: number;
    }[];
  };
  staking: {
    staking_tokens: {
      denom: string;
    }[];
  };
  codebase: {
    git_repo: string;
    recommended_version: string;
    compatible_versions: string[];
    binaries: { [key: string]: string };
    genesis: {
      genesis_url: string;
    };
    versions: [
      {
        name: string;
        recommended_version: string;
        compatible_versions: string[];
        binaries: { [key: string]: string };
        next_version_name: string;
      }
    ];
  };
  logo_URIs: { [key: string]: string };
  description: string;
  peers: {
    seeds: {
      id: string;
      address: string;
    }[];
    persistent_peers: {
      id: string;
      address: string;
    }[];
  };
  apis: {
    rpc: {
      address: string;
      provider: string;
    }[];
    rest: {
      address: string;
      provider: string;
    }[];
    grpc: {
      address: string;
      provider: string;
    }[];
  };
  explorers: {
    kind: string;
    url: string;
    tx_page: string;
    account_page: string;
  }[];
  images: { [key: string]: string }[];
};
