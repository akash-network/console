"use client";
import type { FC } from "react";
import { DiscordLogo } from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import type { AssistantLiveHelpReason } from "@src/types/assistant";

export const LIVE_HELP_REASON_MESSAGES: Record<AssistantLiveHelpReason, string> = {
  provider_side_issue: "This needs someone who can look at the provider side",
  not_supported_here: "The assistant can't do this from Console",
  no_confident_answer: "The assistant isn't sure about this one",
  user_asked_for_a_person: "Talk to the Akash team and community"
};

const DEFAULT_SUBTITLE = "The Akash community and team are there";

type Props = { reason?: AssistantLiveHelpReason | null };

export const DiscordHelpCard: FC<Props> = ({ reason }) => {
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
        <span className="text-xs text-muted-foreground">{reason ? LIVE_HELP_REASON_MESSAGES[reason] : DEFAULT_SUBTITLE}</span>
      </span>
    </a>
  );
};
