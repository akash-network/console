import { netConfig } from "@akashnetwork/net";
import { NextResponse } from "next/server";
import { z } from "zod";

import { serverEnvConfig } from "@/config/server-env.config";

const networkSchema = z.enum(["mainnet", "sandbox", "testnet"]);

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = networkSchema.safeParse(searchParams.get("network"));

  if (!result.success) {
    return NextResponse.json({ error: "Invalid network parameter" }, { status: 400 });
  }

  const network = result.data;

  const config = {
    mainnet: [
      {
        id: "mainnet-1",
        api: serverEnvConfig.DEFAULT_REST_API_NODE_URL_MAINNET ?? netConfig.getBaseAPIUrl("mainnet"),
        rpc: serverEnvConfig.DEFAULT_RPC_NODE_URL_MAINNET ?? netConfig.getBaseRpcUrl("mainnet")
      }
    ],
    sandbox: [
      {
        id: "sandbox-1",
        api: netConfig.getBaseAPIUrl("sandbox"),
        rpc: netConfig.getBaseRpcUrl("sandbox")
      }
    ],
    testnet: [
      {
        id: "testnet-1",
        api: netConfig.getBaseAPIUrl("testnet"),
        rpc: netConfig.getBaseRpcUrl("testnet")
      }
    ]
  };

  return NextResponse.json(config[network]);
}
