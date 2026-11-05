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

export const ACTION_TITLES: Record<AssistantActionType, string> = {
  create_deployment: "Create a deployment",
  choose_bid: "Choose a provider",
  update_deployment: "Update the deployment",
  set_secret: "Set a secret",
  set_registry_credentials: "Set registry credentials",
  redeploy_with_resources: "Redeploy with different resources",
  rename_deployment: "Rename the deployment",
  move_deployment: "Move the deployment",
  add_runtime_hours: "Add runtime hours",
  remove_runtime_limit: "Remove the runtime limit",
  send_manifest_again: "Send the deployment again",
  close_deployment: "Close the deployment",
  create_alert: "Create an alert",
  redeem_coupon: "Redeem a coupon",
  save_as_template: "Save as a template",
  favorite_provider: "Favorite a provider",
  request_hardware: "Request hardware",
  buy_credits: "Buy credits",
  configure_auto_recharge: "Set up auto recharge",
  open_in_editor: "Open in the editor"
};

const HIDDEN_FIELDS = new Set(["type", "tier", "sdl"]);

type Props = { action: AssistantAction; decision: ActionCardDecision; dependencies?: typeof DEPENDENCIES };

/** Shown for any action without a card of its own yet: it summarizes the proposal and only links to where the user can do it themselves. */
export const GenericActionCard: FC<Props> = ({ action, decision, dependencies: d = DEPENDENCIES }) => {
  const href = consoleHrefOf(action);

  return (
    <d.ActionCardChrome title={ACTION_TITLES[action.type]} tier={action.tier} decision={decision} rows={summaryRowsOf(action)}>
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
  if (action.type === "create_alert") return UrlService.alerts();
  if (action.type === "favorite_provider") return UrlService.providerDetail(action.provider);
  return null;
}

function isShownValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function labelOf(key: string): string {
  const words = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
