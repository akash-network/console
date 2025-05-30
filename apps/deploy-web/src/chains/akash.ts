import type { AssetList, Chain } from "@chain-registry/types";
import { assets } from "chain-registry";

export const akash: Chain = {
  $schema: "../chain.schema.json",
  chain_name: "akash",
  status: "live",
  network_type: "mainnet",
  website: "https://akash.network/",
  pretty_name: "Akash",
  chain_type: "cosmos",
  chain_id: "akashnet-2",
  bech32_prefix: "akash",
  daemon_name: "akash",
  node_home: "$HOME/.akash",
  slip44: 118,
  fees: {
    fee_tokens: [
      {
        denom: "uakt",
        fixed_min_gas_price: 0.00025,
        low_gas_price: 0.00025,
        average_gas_price: 0.0025,
        high_gas_price: 0.025
      }
    ]
  },
  staking: {
    staking_tokens: [
      {
        denom: "uakt"
      }
    ]
  },
  codebase: {
    git_repo: "https://github.com/akash-network/node/",
    recommended_version: "v0.36.0",
    compatible_versions: ["v0.36.0"],
    binaries: {
      "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.36.0/akash_linux_amd64.zip",
      "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.36.0/akash_linux_arm64.zip"
    },
    consensus: {
      type: "cometbft",
      version: "v0.34.27",
      repo: "https://github.com/akash-network/cometbft",
      tag: "v0.34.27-akash"
    },
    genesis: {
      genesis_url: "https://raw.githubusercontent.com/akash-network/net/master/mainnet/genesis.json"
    },
    versions: [
      {
        name: "v0.22.0",
        recommended_version: "v0.22.7",
        compatible_versions: ["v0.22.7"],
        binaries: {
          "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.22.7/akash_linux_amd64.zip",
          "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.22.7/akash_linux_arm64.zip"
        },
        next_version_name: "v0.24.0"
      },
      {
        name: "v0.24.0",
        recommended_version: "v0.24.0",
        compatible_versions: ["v0.24.0"],
        binaries: {
          "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.24.0/akash_linux_amd64.zip",
          "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.24.0/akash_linux_arm64.zip"
        },
        next_version_name: "v0.26.0"
      },
      {
        name: "v0.26.0",
        recommended_version: "v0.26.2",
        compatible_versions: ["v0.26.1", "v0.26.2"],
        proposal: 231,
        height: 12992204,
        binaries: {
          "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.26.2/akash_linux_amd64.zip",
          "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.26.2/akash_linux_arm64.zip"
        },
        next_version_name: "v0.28.0"
      },
      {
        name: "v0.28.0",
        recommended_version: "v0.28.2",
        compatible_versions: ["v0.28.2"],
        proposal: 237,
        height: 13759618,
        binaries: {
          "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.28.2/akash_linux_amd64.zip",
          "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.28.2/akash_linux_arm64.zip"
        },
        next_version_name: "v0.30.0"
      },
      {
        name: "v0.30.0",
        recommended_version: "v0.30.0",
        compatible_versions: ["v0.30.0"],
        proposal: 238,
        height: 1388074,
        binaries: {
          "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.30.0/akash_linux_amd64.zip",
          "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.30.0/akash_linux_arm64.zip"
        },
        next_version_name: "v0.32.0"
      },
      {
        name: "v0.32.0",
        recommended_version: "v0.32.1",
        compatible_versions: ["v0.32.1"],
        proposal: 249,
        height: 15414427,
        binaries: {
          "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.32.1/akash_linux_amd64.zip",
          "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.32.1238/akash_linux_arm64.zip"
        },
        consensus: {
          type: "cometbft",
          version: "v0.34.27",
          repo: "https://github.com/akash-network/cometbft",
          tag: "v0.34.27-akash"
        },
        next_version_name: "v0.34.0",
        sdk: {
          type: "cosmos",
          version: "v0.45.16"
        },
        ibc: {
          type: "go",
          version: "v4.4.2"
        }
      },
      {
        name: "v0.34.0",
        recommended_version: "v0.34.1",
        compatible_versions: ["v0.34.1"],
        proposal: 256,
        height: 16133283,
        binaries: {
          "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.34.1/akash_linux_amd64.zip",
          "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.34.1/akash_linux_arm64.zip"
        },
        consensus: {
          type: "cometbft",
          version: "v0.34.27",
          repo: "https://github.com/akash-network/cometbft",
          tag: "v0.34.27-akash"
        },
        next_version_name: "v0.36.0",
        sdk: {
          type: "cosmos",
          version: "v0.45.16"
        },
        ibc: {
          type: "go",
          version: "v4.6.0"
        }
      },
      {
        name: "v0.36.0",
        recommended_version: "v0.36.0",
        compatible_versions: ["v0.36.0"],
        proposal: 257,
        height: 16708237,
        binaries: {
          "linux/amd64": "https://github.com/akash-network/node/releases/download/v0.36.0/akash_linux_amd64.zip",
          "linux/arm64": "https://github.com/akash-network/node/releases/download/v0.36.0/akash_linux_arm64.zip"
        },
        consensus: {
          type: "cometbft",
          version: "v0.34.27",
          repo: "https://github.com/akash-network/cometbft",
          tag: "v0.34.27-akash"
        },
        sdk: {
          type: "cosmos",
          version: "v0.45.16"
        },
        ibc: {
          type: "go",
          version: "v4.6.0"
        }
      }
    ],
    sdk: {
      type: "cosmos",
      version: "v0.45.16"
    },
    ibc: {
      type: "go",
      version: "v4.6.0"
    }
  },
  logo_URIs: {
    png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.png",
    svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg"
  },
  description: "Akash is open-source Supercloud that lets users buy and sell computing resources securely and efficiently. Purpose-built for public utility.",
  peers: {
    seeds: [
      {
        id: "4acf579e2744268f834c713e894850995bbf0ffa",
        address: "50.18.31.225:26656"
      },
      {
        id: "86afe23f116ba4754a19819a55d153008eb74b48",
        address: "15.164.87.75:26656"
      },
      {
        id: "ade4d8bc8cbe014af6ebdf3cb7b1e9ad36f412c0",
        address: "seeds.polkachu.com:12856",
        provider: "Polkachu"
      },
      {
        id: "20e1000e88125698264454a884812746c2eb4807",
        address: "seeds.lavenderfive.com:12856",
        provider: "Lavender.Five Nodes 🐝"
      },
      {
        id: "ebc272824924ea1a27ea3183dd0b9ba713494f83",
        address: "akash-mainnet-seed.autostake.com:26696",
        provider: "AutoStake 🛡️ Slash Protected"
      },
      {
        id: "5e37aefd2a0b9d036b1609a45d6487606da0204b",
        address: "rpc.ny.akash.farm:26656"
      },
      {
        id: "47f7b7a021497ad7a338ea041f19a1a11ae06795",
        address: "rpc.la.akash.farm:26656"
      },
      {
        id: "8542cd7e6bf9d260fef543bc49e59be5a3fa9074",
        address: "seed.publicnode.com:26656",
        provider: "Allnodes ⚡️ Nodes & Staking"
      },
      {
        id: "9aa4c9097c818871e45aaca4118a9fe5e86c60e2",
        address: "seed-akash-01.stakeflow.io:1506",
        provider: "Stakeflow"
      },
      {
        id: "61686e588f0af938484579adbc2093adff06c7aa",
        address: "europlots.com:26656"
      },
      {
        id: "c28827cb96c14c905b127b92065a3fb4cd77d7f6",
        address: "seeds.whispernode.com:12856",
        provider: "WhisperNode 🤐"
      }
    ],
    persistent_peers: [
      {
        id: "4acf579e2744268f834c713e894850995bbf0ffa",
        address: "50.18.31.225:26656"
      },
      {
        id: "86afe23f116ba4754a19819a55d153008eb74b48",
        address: "15.164.87.75:26656"
      },
      {
        id: "20180c45451739668f6e272e007818139dba31e7",
        address: "88.198.62.198:2020"
      },
      {
        id: "1bfbbf77beeb2c1ace50443478035a255a7e510f",
        address: "136.24.44.100:26656"
      },
      {
        id: "ebc272824924ea1a27ea3183dd0b9ba713494f83",
        address: "akash-mainnet-peer.autostake.com:26696",
        provider: "AutoStake 🛡️ Slash Protected"
      },
      {
        id: "9aa4c9097c818871e45aaca4118a9fe5e86c60e2",
        address: "peer-akash-01.stakeflow.io:1506",
        provider: "Stakeflow"
      },
      {
        id: "73ef1c0f9bc77fd925decf7fa41f22a35b5dc76d",
        address: "akash.declab.pro:26603",
        provider: "Decloud Nodes Lab"
      }
    ]
  },
  apis: {
    rpc: [
      {
        address: "https://rpc.akash.forbole.com:443",
        provider: "forbole"
      },
      {
        address: "https://rpc-akash.ecostake.com:443",
        provider: "ecostake"
      },
      {
        address: "https://rpc.lavenderfive.com:443/akash",
        provider: "Lavender.Five Nodes"
      },
      {
        address: "https://akash-rpc.polkachu.com",
        provider: "Polkachu"
      },
      {
        address: "http://akash.c29r3.xyz:80/rpc",
        provider: "c29r3"
      },
      {
        address: "https://akash-rpc.kleomedes.network",
        provider: "Kleomedes"
      },
      {
        address: "https://akash-mainnet-rpc.cosmonautstakes.com:443",
        provider: "Cosmonaut Stakes"
      },
      {
        address: "https://akash-rpc.w3coins.io",
        provider: "w3coins"
      },
      {
        address: "https://akash-rpc.publicnode.com:443",
        provider: "Allnodes ⚡️ Nodes & Staking"
      },
      {
        address: "https://akash.declab.pro:26601",
        provider: "Decloud Nodes Lab"
      },
      {
        address: "https://rpc.akash.bronbro.io:443",
        provider: "Bro_n_Bro"
      }
    ],
    rest: [
      {
        address: "https://api.akash.forbole.com:443",
        provider: "forbole"
      },
      {
        address: "https://rest-akash.ecostake.com",
        provider: "ecostake"
      },
      {
        address: "https://rest.lavenderfive.com:443/akash",
        provider: "Lavender.Five Nodes"
      },
      {
        address: "https://akash-api.polkachu.com",
        provider: "Polkachu"
      },
      {
        address: "https://api-akash.cosmos-spaces.cloud",
        provider: "Cosmos Spaces"
      },
      {
        address: "https://api-akash-ia.cosmosia.notional.ventures",
        provider: "Notional"
      },
      {
        address: "https://akash.c29r3.xyz:443/api",
        provider: "c29r3"
      },
      {
        address: "https://akash-mainnet-lcd.autostake.com:443",
        provider: "AutoStake 🛡️ Slash Protected"
      },
      {
        address: "https://akash-api.kleomedes.network",
        provider: "Kleomedes"
      },
      {
        address: "https://api-akash-01.stakeflow.io",
        provider: "Stakeflow"
      },
      {
        address: "https://akash-mainnet-rest.cosmonautstakes.com:443",
        provider: "Cosmonaut Stakes"
      },
      {
        address: "https://akash-api.w3coins.io",
        provider: "w3coins"
      },
      {
        address: "https://akash-rest.publicnode.com",
        provider: "Allnodes ⚡️ Nodes & Staking"
      },
      {
        address: "https://akash-api.validatornode.com",
        provider: "ValidatorNode"
      },
      {
        address: "https://api-akash.whispernode.com:443",
        provider: "WhisperNode 🤐"
      },
      {
        address: "https://public.stakewolle.com/cosmos/akash/rest",
        provider: "Stakewolle"
      },
      {
        address: "https://akash.declab.pro:443",
        provider: "Decloud Nodes Lab"
      },
      {
        address: "https://lcd.akash.bronbro.io:443",
        provider: "Bro_n_Bro"
      }
    ],
    grpc: [
      {
        address: "grpc-akash-ia.cosmosia.notional.ventures:443",
        provider: "Notional"
      },
      {
        address: "akash.lavenderfive.com:443",
        provider: "Lavender.Five Nodes 🐝"
      },
      {
        address: "akash-grpc.polkachu.com:12890",
        provider: "Polkachu"
      },
      {
        address: "akash-mainnet-grpc.autostake.com:443",
        provider: "AutoStake 🛡️ Slash Protected"
      },
      {
        address: "grpc-akash.cosmos-spaces.cloud:1110",
        provider: "Cosmos Spaces"
      },
      {
        address: "grpc-akash-01.stakeflow.io:1502",
        provider: "Stakeflow"
      },
      {
        address: "akash-grpc.w3coins.io:12890",
        provider: "w3coins"
      },
      {
        address: "akash-grpc.publicnode.com:443",
        provider: "Allnodes ⚡️ Nodes & Staking"
      },
      {
        address: "https://akash.declab.pro:9001",
        provider: "Decloud Nodes Lab"
      },
      {
        address: "grpc-akash.whispernode.com:443",
        provider: "WhisperNode 🤐"
      },
      {
        address: "https://grpc.akash.bronbro.io:443",
        provider: "Bro_n_Bro"
      }
    ]
  },
  explorers: [
    {
      kind: "ezstaking",
      url: "https://ezstaking.app/akash",
      tx_page: "https://ezstaking.app/akash/txs/${txHash}",
      account_page: "https://ezstaking.app/akash/account/${accountAddress}"
    },
    {
      kind: "mintscan",
      url: "https://www.mintscan.io/akash",
      tx_page: "https://www.mintscan.io/akash/transactions/${txHash}",
      account_page: "https://www.mintscan.io/akash/accounts/${accountAddress}"
    },
    {
      kind: "ping.pub",
      url: "https://ping.pub/akash-network",
      tx_page: "https://ping.pub/akash-network/tx/${txHash}"
    },
    {
      kind: "staking-explorer.com",
      url: "https://staking-explorer.com/explorer/akash",
      tx_page: "https://staking-explorer.com/transaction.php?chain=akash&tx=${txHash}",
      account_page: "https://staking-explorer.com/account.php?chain=akash&addr=${accountAddress}"
    },
    {
      kind: "atomscan",
      url: "https://atomscan.com/akash",
      tx_page: "https://atomscan.com/akash/transactions/${txHash}",
      account_page: "https://atomscan.com/akash/accounts/${accountAddress}"
    },
    {
      kind: "akash-stats",
      url: "https://stats.akash.network/blocks",
      tx_page: "https://stats.akash.network/transactions/${txHash}"
    },
    {
      kind: "Stakeflow",
      url: "https://stakeflow.io/akash",
      account_page: "https://stakeflow.io/akash/accounts/${accountAddress}"
    },
    {
      kind: "ValidatorNode",
      url: "https://explorer.validatornode.com/akash-network",
      tx_page: "https://explorer.validatornode.com/akash-network/tx/${txHash}"
    },
    {
      kind: "Decloud Nodes Lab",
      url: "https://explorer.declab.pro/Akash",
      tx_page: "https://explorer.declab.pro/Akash/tx/${txHash}"
    },
    {
      kind: "WhisperNode 🤐",
      url: "https://mainnet.whispernode.com/akash",
      tx_page: "https://mainnet.whispernode.com/akash/tx/${txHash}",
      account_page: "https://mainnet.whispernode.com/akash/account/${accountAddress}"
    }
  ],
  images: [
    {
      png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.png",
      svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
      theme: {
        primary_color_hex: "#bc342c"
      }
    }
  ]
};

export const akashAssetList = assets.find(x => x.chain_name === "akash") as AssetList;
