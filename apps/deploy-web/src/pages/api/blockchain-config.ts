/* v8 ignore start */
import { netConfig } from "@akashnetwork/net";
import { z } from "zod";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";

export default defineApiHandler({
  route: "/api/blockchain-config",
  schema: z.object({
    query: z.object({
      network: z.enum(["mainnet", "sandbox", "testnet"])
    })
  }),
  async handler({ query, res, services }) {
    const config = {
      mainnet: [
        nodeWithId({
          api: services.privateConfig.DEFAULT_REST_API_NODE_URL_MAINNET ?? netConfig.getBaseAPIUrl("mainnet"),
          rpc: services.privateConfig.DEFAULT_RPC_NODE_URL_MAINNET ?? netConfig.getBaseRpcUrl("mainnet")
        })
      ],
      sandbox: [
        nodeWithId({
          api: netConfig.getBaseAPIUrl("sandbox"),
          rpc: netConfig.getBaseRpcUrl("sandbox")
        })
      ],
      testnet: [
        nodeWithId({
          api: netConfig.getBaseAPIUrl("testnet"),
          rpc: netConfig.getBaseRpcUrl("testnet")
        })
      ]
    };
    const data = config[query.network]?.map(node => {
      node.id = new URL(node.api).hostname;
      return node;
    });
    res.status(200).json(data);
  }
});

function nodeWithId(node: { api: string; rpc: string }) {
  return {
    ...node,
    id: new URL(node.api).hostname
  };
}
