/* v8 ignore start */
import { netConfig } from "@akashnetwork/net";
import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import type { AppServices } from "@src/services/app-di-container/server-di-container.service";

export default defineApiHandler({
  route: "/api/blockchain-config",
  schema: z.object({
    query: z.object({
      network: z.enum(["mainnet", "sandbox", "testnet"])
    })
  }),
  async handler({ query, res, services }) {
    const allNetworksConfig = createNetworksConfig(services.privateConfig);
    let networkConfig: Array<ReturnType<typeof nodeWithId>>;
    try {
      networkConfig = allNetworksConfig[query.network];
    } catch (error) {
      res.status(422).json({ error: `Unable to fetch ${query.network} blockchain network config. Does this network exist?` });
      return;
    }

    res.status(200).json(networkConfig);
  }
});

function createNetworksConfig(privateConfig: Pick<AppServices["privateConfig"], "DEFAULT_REST_API_NODE_URL_MAINNET" | "DEFAULT_RPC_NODE_URL_MAINNET">) {
  const networks = {
    get mainnet() {
      return [
        nodeWithId({
          api: privateConfig.DEFAULT_REST_API_NODE_URL_MAINNET ?? netConfig.getBaseAPIUrl("mainnet"),
          rpc: privateConfig.DEFAULT_RPC_NODE_URL_MAINNET ?? netConfig.getBaseRpcUrl("mainnet")
        })
      ];
    },
    get sandbox() {
      return [
        nodeWithId({
          api: netConfig.getBaseAPIUrl("sandbox"),
          rpc: netConfig.getBaseRpcUrl("sandbox")
        })
      ];
    },
    get testnet() {
      return [
        nodeWithId({
          api: netConfig.getBaseAPIUrl("testnet"),
          rpc: netConfig.getBaseRpcUrl("testnet")
        })
      ];
    }
  };
  return networks;
}

function nodeWithId(node: { api: string; rpc: string }) {
  return {
    ...node,
    id: new URL(node.api).hostname
  };
}
