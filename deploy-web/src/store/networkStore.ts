import { Network } from "@src/types/network";
import { ApiUrlService } from "@src/utils/apiUtils";
import { mainnetId, mainnetNodes, sandboxId, sandboxNodes, testnetId, testnetNodes } from "@src/utils/constants";
import axios from "axios";
import { atom } from "jotai";

export let networks: Network[] = [
  {
    id: mainnetId,
    title: "Mainnet",
    description: "Akash Network mainnet network.",
    nodesUrl: mainnetNodes,
    chainId: "akashnet-2",
    chainRegistryName: "akash",
    versionUrl: ApiUrlService.mainnetVersion(),
    rpcEndpoint: "https://rpc.cosmos.directory/akash",
    enabled: true,
    version: null // Set asynchronously
  },
  {
    id: testnetId,
    title: "GPU Testnet",
    description: "Testnet of the new GPU features.",
    nodesUrl: testnetNodes,
    chainId: "testnet-02",
    chainRegistryName: "akash-testnet",
    versionUrl: ApiUrlService.testnetVersion(),
    rpcEndpoint: "https://rpc.testnet-02.aksh.pw:443",
    enabled: false,
    version: null, // Set asynchronously
    suggestWalletChain: async () => {
      await window.wallet.experimentalSuggestChain({
        // Chain-id of the Craft chain.
        chainId: "testnet-02",
        // The name of the chain to be displayed to the user.
        chainName: "Testnet-02-GPU",
        // RPC endpoint of the chain. In this case we are using blockapsis, as it's accepts connections from any host currently. No Cors limitations.
        rpc: "https://rpc.testnet-02.aksh.pw",
        // REST endpoint of the chain.
        rest: "https://api.testnet-02.aksh.pw",
        // Staking coin information
        stakeCurrency: {
          // Coin denomination to be displayed to the user.
          coinDenom: "AKT",
          // Actual denom (i.e. uatom, uscrt) used by the blockchain.
          coinMinimalDenom: "uakt",
          // # of decimal points to convert minimal denomination to user-facing denomination.
          coinDecimals: 6
          // (Optional) Keplr can show the fiat value of the coin if a coingecko id is provided.
          // You can get id from https://api.coingecko.com/api/v3/coins/list if it is listed.
          // coinGeckoId: ""
        },
        bip44: {
          // You can only set the coin type of BIP44.
          // 'Purpose' is fixed to 44.
          coinType: 118
        },
        // Bech32 configuration to show the address to user.
        // This field is the interface of
        bech32Config: {
          bech32PrefixAccAddr: "akash",
          bech32PrefixAccPub: "akashpub",
          bech32PrefixValAddr: "akashvaloper",
          bech32PrefixValPub: "akashvaloperpub",
          bech32PrefixConsAddr: "akashvalcons",
          bech32PrefixConsPub: "akashvalconspub"
        },
        // List of all coin/tokens used in this chain.
        currencies: [
          {
            // Coin denomination to be displayed to the user.
            coinDenom: "AKT",
            // Actual denom (i.e. uatom, uscrt) used by the blockchain.
            coinMinimalDenom: "uakt",
            // # of decimal points to convert minimal denomination to user-facing denomination.
            coinDecimals: 6
            // (Optional) Keplr can show the fiat value of the coin if a coingecko id is provided.
            // You can get id from https://api.coingecko.com/api/v3/coins/list if it is listed.
            // coinGeckoId: ""
          }
        ],
        // List of coin/tokens used as a fee token in this chain.
        feeCurrencies: [
          {
            // Coin denomination to be displayed to the user.
            coinDenom: "AKT",
            // Actual denom (i.e. uosmo, uscrt) used by the blockchain.
            coinMinimalDenom: "uakt",
            // # of decimal points to convert minimal denomination to user-facing denomination.
            coinDecimals: 6,
            // (Optional) Keplr can show the fiat value of the coin if a coingecko id is provided.
            // You can get id from https://api.coingecko.com/api/v3/coins/list if it is listed.
            coinGeckoId: "akash-network"
          }
        ],
        coinType: 118,
        // Make sure that the gas prices are higher than the minimum gas prices accepted by chain validators and RPC/REST endpoint.
        gasPriceStep: {
          low: 0.01,
          average: 0.025,
          high: 0.04
        }
      });
    }
  },
  {
    id: sandboxId,
    title: "Sandbox",
    description: "Sandbox of the mainnet version.",
    nodesUrl: sandboxNodes,
    chainId: "sandbox-01",
    chainRegistryName: "akash-sandbox",
    versionUrl: ApiUrlService.sandboxVersion(),
    rpcEndpoint: "https://rpc.sandbox-01.aksh.pw:443",
    version: null, // Set asynchronously
    enabled: true,
    suggestWalletChain: async () => {
      await window.wallet.experimentalSuggestChain({
        // Chain-id of the Craft chain.
        chainId: "sandbox-01",
        // The name of the chain to be displayed to the user.
        chainName: "Akash-Sandbox",
        // RPC endpoint of the chain. In this case we are using blockapsis, as it's accepts connections from any host currently. No Cors limitations.
        rpc: "https://rpc.sandbox-01.aksh.pw",
        // REST endpoint of the chain.
        rest: "https://api.sandbox-01.aksh.pw",
        // Staking coin information
        stakeCurrency: {
          // Coin denomination to be displayed to the user.
          coinDenom: "AKT",
          // Actual denom (i.e. uatom, uscrt) used by the blockchain.
          coinMinimalDenom: "uakt",
          // # of decimal points to convert minimal denomination to user-facing denomination.
          coinDecimals: 6
          // (Optional) Keplr can show the fiat value of the coin if a coingecko id is provided.
          // You can get id from https://api.coingecko.com/api/v3/coins/list if it is listed.
          // coinGeckoId: ""
        },
        bip44: {
          // You can only set the coin type of BIP44.
          // 'Purpose' is fixed to 44.
          coinType: 118
        },
        // Bech32 configuration to show the address to user.
        // This field is the interface of
        bech32Config: {
          bech32PrefixAccAddr: "akash",
          bech32PrefixAccPub: "akashpub",
          bech32PrefixValAddr: "akashvaloper",
          bech32PrefixValPub: "akashvaloperpub",
          bech32PrefixConsAddr: "akashvalcons",
          bech32PrefixConsPub: "akashvalconspub"
        },
        // List of all coin/tokens used in this chain.
        currencies: [
          {
            // Coin denomination to be displayed to the user.
            coinDenom: "AKT",
            // Actual denom (i.e. uatom, uscrt) used by the blockchain.
            coinMinimalDenom: "uakt",
            // # of decimal points to convert minimal denomination to user-facing denomination.
            coinDecimals: 6
            // (Optional) Keplr can show the fiat value of the coin if a coingecko id is provided.
            // You can get id from https://api.coingecko.com/api/v3/coins/list if it is listed.
            // coinGeckoId: ""
          }
        ],
        // List of coin/tokens used as a fee token in this chain.
        feeCurrencies: [
          {
            // Coin denomination to be displayed to the user.
            coinDenom: "AKT",
            // Actual denom (i.e. uosmo, uscrt) used by the blockchain.
            coinMinimalDenom: "uakt",
            // # of decimal points to convert minimal denomination to user-facing denomination.
            coinDecimals: 6,
            // (Optional) Keplr can show the fiat value of the coin if a coingecko id is provided.
            // You can get id from https://api.coingecko.com/api/v3/coins/list if it is listed.
            coinGeckoId: "akash-network"
          }
        ],
        coinType: 118,
        // Make sure that the gas prices are higher than the minimum gas prices accepted by chain validators and RPC/REST endpoint.
        gasPriceStep: {
          low: 0.01,
          average: 0.025,
          high: 0.04
        }
      });
    }
  }
];

/**
 * Get the actual versions and metadata of the available networks
 */
export const initiateNetworkData = async () => {
  networks = await Promise.all(
    networks.map(async network => {
      let version = null;
      try {
        const response = await axios.get(network.versionUrl, { timeout: 10000 });
        version = response.data;
      } catch (error) {
        console.log(error);
      }

      return {
        ...network,
        version
      };
    })
  );
};

const selectedNetwork = atom<Network>(networks[0]);

export default {
  selectedNetwork
};
