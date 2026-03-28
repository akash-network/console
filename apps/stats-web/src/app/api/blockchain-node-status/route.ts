import { netConfig } from "@akashnetwork/net";
import { NextResponse } from "next/server";
import { z } from "zod";

import { serverEnvConfig } from "@/config/server-env.config";

const networkSchema = z.enum(["mainnet", "sandbox", "testnet"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = networkSchema.safeParse(searchParams.get("network"));

  if (!result.success) {
    return NextResponse.json({ error: "Invalid network parameter" }, { status: 400 });
  }

  const network = result.data;
  const apiUrl =
    network === "mainnet" ? serverEnvConfig.DEFAULT_REST_API_NODE_URL_MAINNET ?? netConfig.getBaseAPIUrl("mainnet") : netConfig.getBaseAPIUrl(network);

  try {
    const response = await fetch(`${apiUrl}/cosmos/base/tendermint/v1beta1/node_info`, {
      signal: AbortSignal.timeout(5000)
    });

    return NextResponse.json({ isHealthy: response.ok });
  } catch {
    return NextResponse.json({ isHealthy: false });
  }
}
