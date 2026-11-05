"use client";
import type { FC } from "react";
import { DiscordLogo } from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";

export const DiscordHelpCard: FC = () => {
  const { publicConfig } = useServices();

  return (
    <a
      href={publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5865F2] text-white">
        <DiscordLogo className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">Get live help on Discord</span>
        <span className="text-xs text-muted-foreground">The Akash community and team are there</span>
      </span>
    </a>
  );
};
