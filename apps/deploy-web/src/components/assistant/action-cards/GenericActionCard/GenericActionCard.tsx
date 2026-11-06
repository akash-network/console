"use client";
import type { FC } from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import Link from "next/link";

import type { AssistantAction, AssistantActionType } from "@src/types/assistant";
import { UrlService } from "@src/utils/urlUtils";
import type { ActionCardRow } from "../ActionCardChrome/ActionCardChrome";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";

export const DEPENDENCIES = { ActionCardChrome };

/** A switch rather than a record keyed by action type, so a key like set_secret never reads to Snyk Code as a hardcoded secret. */
export function actionTitleOf(type: AssistantActionType): string {
  switch (type) {
    case "create_deployment":
      return "Create a deployment";
    case "choose_bid":
      return "Choose a provider";
    case "update_deployment":
      return "Update the deployment";
    case "set_secret":
      return "Set a secret";
    case "set_registry_credentials":
      return "Set registry credentials";
    case "redeploy_with_resources":
      return "Redeploy with different resources";
    case "rename_deployment":
      return "Rename the deployment";
    case "move_deployment":
      return "Move the deployment";
    case "add_runtime_hours":
      return "Add runtime hours";
    case "remove_runtime_limit":
      return "Remove the runtime limit";
    case "send_manifest_again":
      return "Send the deployment again";
    case "close_deployment":
      return "Close the deployment";
    case "create_alert":
      return "Create an alert";
    case "redeem_coupon":
      return "Redeem a coupon";
    case "save_as_template":
      return "Save as a template";
    case "favorite_provider":
      return "Favorite a provider";
    case "request_hardware":
      return "Request hardware";
    case "buy_credits":
      return "Buy credits";
    case "configure_auto_recharge":
      return "Set up auto recharge";
    case "open_in_editor":
      return "Open in the editor";
  }
}

const HIDDEN_FIELDS = new Set(["type", "tier", "sdl"]);

type Props = { action: AssistantAction; decision: ActionCardDecision; dependencies?: typeof DEPENDENCIES };

/** Shown for any action without a card of its own yet: it summarizes the proposal and only links to where the user can do it themselves. */
export const GenericActionCard: FC<Props> = ({ action, decision, dependencies: d = DEPENDENCIES }) => {
  const href = consoleHrefOf(action);

  return (
    <d.ActionCardChrome title={actionTitleOf(action.type)} tier={action.tier} decision={decision} rows={summaryRowsOf(action)}>
      {href && decision.status === "pending" && (
        <Link href={href} className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}>
          Open in Console
        </Link>
      )}
    </d.ActionCardChrome>
  );
};

export function summaryRowsOf(action: AssistantAction): ActionCardRow[] {
  return Object.entries(action)
    .filter(([key, value]) => !HIDDEN_FIELDS.has(key) && isShownValue(value))
    .map(([key, value]) => ({ label: labelOf(key), value: String(value) }));
}

export function consoleHrefOf(action: AssistantAction): string | null {
  if ("dseq" in action && action.dseq) return UrlService.deploymentDetails(action.dseq);
  if (action.type === "buy_credits" || action.type === "configure_auto_recharge" || action.type === "redeem_coupon") return UrlService.billing();
  if (action.type === "favorite_provider") return UrlService.providerDetail(action.provider);
  return null;
}

function isShownValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

const ACRONYMS: Record<string, string> = { gpu: "GPU", usd: "USD", sdl: "SDL", id: "ID" };

function labelOf(key: string): string {
  const words = key
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .split(" ")
    .map(word => ACRONYMS[word] ?? word)
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
