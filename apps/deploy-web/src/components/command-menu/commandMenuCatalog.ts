import type { LucideIcon } from "lucide-react";
import { Bell, BookCopy, ChartColumn, Container, KeyRound, Layers, Plus, Shield, Terminal, Wallet } from "lucide-react";

import { UrlService } from "@src/utils/urlUtils";
import type { DeploymentStart } from "./useStartDeployment";

export type CommandPageId = "deployments" | "templates" | "providers" | "billing" | "api_keys" | "usage" | "alerts";

export type CommandAction =
  | "new_deployment"
  | "new_container"
  | "new_linux_machine"
  | "deploy_from_template"
  | "add_funds"
  | "toggle_theme"
  | "keyboard_shortcuts"
  | "open_deployment"
  | `go_to_${CommandPageId}`;

/** "mod" is ⌘ on a Mac and Ctrl elsewhere; any other token is the key as printed on the keycap. */
export type KeyToken = "mod" | "shift" | (string & {});

export interface Shortcut {
  keys: KeyToken[];
  isSequence?: boolean;
}

export interface CommandPage {
  id: CommandPageId;
  label: string;
  icon: LucideIcon;
  href: string;
  goKey: string;
}

export interface DeploymentStartCommand {
  kind: DeploymentStart;
  action: CommandAction;
  label: string;
  icon: LucideIcon;
  keywords: string;
  shortcut: Shortcut;
}

export const COMMAND_PAGES: CommandPage[] = [
  { id: "deployments", label: "Deployments", icon: Layers, href: UrlService.deploymentList(), goKey: "D" },
  { id: "templates", label: "Templates", icon: BookCopy, href: UrlService.templates(), goKey: "T" },
  { id: "providers", label: "Providers", icon: Shield, href: UrlService.providers(), goKey: "R" },
  { id: "billing", label: "Billing", icon: Wallet, href: UrlService.billing(), goKey: "B" },
  { id: "api_keys", label: "API Keys", icon: KeyRound, href: UrlService.userApiKeys(), goKey: "K" },
  { id: "usage", label: "Usage", icon: ChartColumn, href: UrlService.usage(), goKey: "U" },
  { id: "alerts", label: "Alerts", icon: Bell, href: UrlService.alerts(), goKey: "A" }
];

export const DEPLOYMENT_START_COMMANDS: DeploymentStartCommand[] = [
  { kind: "new-deployment", action: "new_deployment", label: "New deployment", icon: Plus, keywords: "create deploy launch", shortcut: { keys: ["N"] } },
  {
    kind: "container",
    action: "new_container",
    label: "New container",
    icon: Container,
    keywords: "docker image byo bring your own container deploy configure",
    shortcut: { keys: ["shift", "C"] }
  },
  {
    kind: "linux",
    action: "new_linux_machine",
    label: "New Linux machine",
    icon: Terminal,
    keywords: "ssh ubuntu debian centos suse vm server linux deploy configure",
    shortcut: { keys: ["shift", "L"] }
  }
];

export const MENU_TOGGLE_SHORTCUT: Shortcut = { keys: ["mod", "K"] };

export const SHOW_SHORTCUTS_SHORTCUT: Shortcut = { keys: ["?"] };

export const GO_KEY = "G";

export function goToShortcut(page: CommandPage): Shortcut {
  return { keys: [GO_KEY, page.goKey], isSequence: true };
}
