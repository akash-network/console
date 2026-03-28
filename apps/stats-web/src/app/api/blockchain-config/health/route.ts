import { netConfig } from "@akashnetwork/net";
import { NextResponse } from "next/server";
import { z } from "zod";

import { serverEnvConfig } from "@/config/server-env.config";

export type BlockchainHealthStatus = "healthy" | "rpc-issue" | "chain-down";

const networkSchema = z.enum(["mainnet", "sandbox", "testnet"]);

const STALE_BLOCK_THRESHOLD_MS = 2 * 60_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = networkSchema.safeParse(searchParams.get("network"));

  if (!result.success) {
    return NextResponse.json({ error: "Invalid network parameter" }, { status: 400 });
  }

  const network = result.data;
  const apiUrl =
    network === "mainnet" ? serverEnvConfig.DEFAULT_REST_API_NODE_URL_MAINNET ?? netConfig.getBaseAPIUrl("mainnet") : netConfig.getBaseAPIUrl(network);

  let nodeInfoResponse: Response;
  try {
    nodeInfoResponse = await fetch(`${apiUrl}/cosmos/base/tendermint/v1beta1/node_info`, {
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    return NextResponse.json({ status: "rpc-issue" satisfies BlockchainHealthStatus });
  }

  if (nodeInfoResponse.status >= 502 && nodeInfoResponse.status <= 504) {
    return NextResponse.json({ status: "rpc-issue" satisfies BlockchainHealthStatus });
  }

  if (!nodeInfoResponse.ok) {
    return NextResponse.json({ status: "chain-down" satisfies BlockchainHealthStatus });
  }

  try {
    const syncResponse = await fetch(`${apiUrl}/cosmos/base/tendermint/v1beta1/syncing`, {
      signal: AbortSignal.timeout(5000)
    });

    if (syncResponse.ok) {
      const syncData = (await syncResponse.json()) as { syncing: boolean };

      if (syncData.syncing) {
        return NextResponse.json({ status: "rpc-issue" satisfies BlockchainHealthStatus });
      }
    }

    const latestBlockResponse = await fetch(`${apiUrl}/cosmos/base/tendermint/v1beta1/blocks/latest`, {
      signal: AbortSignal.timeout(5000)
    });

    if (latestBlockResponse.ok) {
      const blockData = (await latestBlockResponse.json()) as { block: { header: { time: string } } };
      const blockTime = new Date(blockData.block.header.time).getTime();
      const isStale = Date.now() - blockTime > STALE_BLOCK_THRESHOLD_MS;

      if (isStale) {
        return NextResponse.json({ status: "chain-down" satisfies BlockchainHealthStatus });
      }
    }
  } catch {
    // node_info succeeded but extra checks failed — still consider it reachable
  }

  return NextResponse.json({ status: "healthy" satisfies BlockchainHealthStatus });
}
