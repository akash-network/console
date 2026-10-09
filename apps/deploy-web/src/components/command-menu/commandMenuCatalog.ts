import type { LucideIcon } from "lucide-react";
import { Bell, BookCopy, ChartColumn, KeyRound, Layers, Shield, Wallet } from "lucide-react";

import { UrlService } from "@src/utils/urlUtils";

export type CommandPageId = "deployments" | "templates" | "providers" | "billing" | "api_keys" | "usage" | "alerts";

export type CommandAction =
  | "new_deployment"
  | "new_container"
  | "new_linux_machine"
  | "deploy_from_template"
  | "add_funds"
  | "toggle_theme"
  | "open_deployment"
  | `go_to_${CommandPageId}`;

export interface CommandPage {
  id: CommandPageId;
  label: string;
  icon: LucideIcon;
  href: string;
}

export const COMMAND_PAGES: CommandPage[] = [
  { id: "deployments", label: "Deployments", icon: Layers, href: UrlService.deploymentList() },
  { id: "templates", label: "Templates", icon: BookCopy, href: UrlService.templates() },
  { id: "providers", label: "Providers", icon: Shield, href: UrlService.providers() },
  { id: "billing", label: "Billing", icon: Wallet, href: UrlService.billing() },
  { id: "api_keys", label: "API Keys", icon: KeyRound, href: UrlService.userApiKeys() },
  { id: "usage", label: "Usage", icon: ChartColumn, href: UrlService.usage() },
  { id: "alerts", label: "Alerts", icon: Bell, href: UrlService.alerts() }
];
