import type { AssistantUserBlockOutput } from "@src/feedback/repositories/assistant-user-block/assistant-user-block.repository";
import type { AssistantSlackMessage } from "@src/feedback/services/assistant-slack-notifier/assistant-slack-notifier.service";

export const USER_BLOCK_HEADLINE = ":no_entry: *Assistant turned off for an account*";

function describeBlock(block: Pick<AssistantUserBlockOutput, "source" | "blockedUntil" | "flaggedTurnCount">): string {
  const until = block.blockedUntil ? `until ${block.blockedUntil.toISOString().slice(0, 16).replace("T", " ")} UTC` : "permanently";
  const flagged = block.flaggedTurnCount === null ? [] : [`${block.flaggedTurnCount} flagged turns today`];

  return [`${block.source} block`, ...flagged, until].join(" · ");
}

/** Carries no user text, so nothing the user wrote ever reaches Slack. */
export function buildUserBlockSlackMessage(input: {
  block: Pick<AssistantUserBlockOutput, "source" | "blockedUntil" | "flaggedTurnCount">;
  adminConversationsUrl: string | undefined;
}): AssistantSlackMessage {
  const lines = [USER_BLOCK_HEADLINE, describeBlock(input.block)];
  if (input.adminConversationsUrl) lines.push(`<${input.adminConversationsUrl}|Open in admin>`);

  return { text: lines.join("\n") };
}
