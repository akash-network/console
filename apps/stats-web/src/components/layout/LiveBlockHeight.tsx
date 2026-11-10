"use client";
import { FormattedNumber } from "react-intl";
import { MAINNET_ID } from "@akashnetwork/chain-sdk/web";

import { cn } from "@/lib/utils";
import { useBlocks } from "@/queries";
import { networkStore } from "@/store/network.store";

const BLOCK_REFRESH_INTERVAL_MS = 6000;

export function LiveBlockHeight({ className }: { className?: string }) {
  const { data: blocks, isError } = useBlocks(1, { refetchInterval: BLOCK_REFRESH_INTERVAL_MS });
  const selectedNetwork = networkStore.useSelectedNetwork();
  const height = blocks?.[0]?.height;
  const isLive = !!height && !isError;
  const liveLabel = selectedNetwork.id === MAINNET_ID ? "LIVE" : selectedNetwork.title.toUpperCase();

  return (
    <div className={cn("flex min-w-0 items-center gap-2 rounded-full border px-3 py-[7px] font-mono text-[11px] font-medium leading-none", className)}>
      <span className={cn("h-1.5 w-1.5 flex-none animate-live-pulse rounded-full", isLive ? "bg-akash" : "bg-faint")} aria-hidden />
      <span className="tracking-[0.08em] text-muted-foreground">{isLive ? liveLabel : isError ? "OFFLINE" : "SYNCING"}</span>
      {height !== undefined && (
        <span className="truncate text-foreground">
          <FormattedNumber value={height} />
        </span>
      )}
    </div>
  );
}
