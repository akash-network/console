import type { LucideIcon } from "lucide-react";
import { Keyboard, LayoutGrid, Moon, Sun, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { DEPLOYMENT_STATUS_DOT_CLASSES, getDeploymentStatus } from "@src/components/deployments/DeploymentDetail/DeploymentStatusBadge";
import type { DeploymentsListSource } from "@src/components/deployments/DeploymentsList/useApiDeploymentsListSource";
import { useApiDeploymentsListSource } from "@src/components/deployments/DeploymentsList/useApiDeploymentsListSource";
import { useAddCredits } from "@src/hooks/useAddCredits";
import { ADD_FUNDS_EMAIL_VERIFICATION_MESSAGE } from "@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler";
import { useRunWhenEmailVerified } from "@src/hooks/useEmailVerificationRequiredEventHandler";
import type { ListedDeploymentDto } from "@src/types/deployment";
import { rememberThemeChoice } from "@src/utils/themeChoice/themeChoice";
import { UrlService } from "@src/utils/urlUtils";
import type { CommandAction, Shortcut } from "./commandMenuCatalog";
import { COMMAND_PAGES, DEPLOYMENT_START_COMMANDS, goToShortcut, SHOW_SHORTCUTS_SHORTCUT } from "./commandMenuCatalog";
import type { CommandSection, ParsedQuery, SearchableItem } from "./commandMenuSearch";
import { useStartDeployment } from "./useStartDeployment";

export const DEPENDENCIES = { useRouter, useTheme, useAddCredits, useRunWhenEmailVerified, useStartDeployment, useApiDeploymentsListSource };

export interface CommandItem extends SearchableItem {
  icon?: LucideIcon;
  statusDotClassName?: string;
  isMonospace?: boolean;
  staysOnPage?: boolean;
  shortcut?: Shortcut;
  action: CommandAction;
  run: () => void;
}

const DEPLOYMENTS_WITHOUT_QUERY = 5;

/** Also used without a query, because a size change reaches the request before the search delayed by the list source does. */
const DEPLOYMENTS_OUTSIDE_SCOPE = 6;

const DEPLOYMENTS_IN_SCOPE = 50;

export function useCommandMenuItems(
  { parsed, onShowShortcuts }: { parsed: ParsedQuery; onShowShortcuts: () => void },
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): CommandSection<CommandItem>[] {
  const router = dependencies.useRouter();
  const { resolvedTheme, setTheme } = dependencies.useTheme();
  const openAddCredits = dependencies.useAddCredits();
  const runWhenEmailVerified = dependencies.useRunWhenEmailVerified();
  const startDeployment = dependencies.useStartDeployment();
  const deploymentsSource = dependencies.useApiDeploymentsListSource({ ...deploymentsRequestFor(parsed), pageIndex: 0, archivePageIndex: 0 });
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  const actions: CommandItem[] = [
    ...DEPLOYMENT_START_COMMANDS.map<CommandItem>(command => ({
      id: `action-${command.action.replace(/_/g, "-")}`,
      label: command.label,
      icon: command.icon,
      keywords: command.keywords,
      shortcut: command.shortcut,
      action: command.action,
      run: () => startDeployment(command.kind)
    })),
    {
      id: "action-deploy-from-template",
      label: "Deploy from a template",
      icon: LayoutGrid,
      keywords: "templates catalog",
      action: "deploy_from_template",
      run: () => router.push(UrlService.templates())
    },
    {
      id: "action-add-funds",
      label: "Add funds",
      icon: Wallet,
      keywords: "billing balance top up credit",
      action: "add_funds",
      run: () => runWhenEmailVerified(ADD_FUNDS_EMAIL_VERIFICATION_MESSAGE, () => openAddCredits({ context: "command_menu" }))
    },
    {
      id: "action-toggle-theme",
      label: `Switch to ${nextTheme} theme`,
      icon: nextTheme === "dark" ? Moon : Sun,
      keywords: "theme appearance mode dark light",
      staysOnPage: true,
      action: "toggle_theme",
      run: () => {
        setTheme(nextTheme);
        rememberThemeChoice(nextTheme);
      }
    },
    {
      id: "action-keyboard-shortcuts",
      label: "Keyboard shortcuts",
      icon: Keyboard,
      keywords: "help hotkeys keys",
      shortcut: SHOW_SHORTCUTS_SHORTCUT,
      action: "keyboard_shortcuts",
      run: onShowShortcuts
    }
  ];

  const deployments = listDeployments(deploymentsSource, parsed).map(listing =>
    toDeploymentItem(listing, () => router.push(UrlService.deploymentDetails(listing.deployment.dseq)))
  );

  const pages = COMMAND_PAGES.map<CommandItem>(page => ({
    id: `page-${page.id}`,
    label: page.label,
    icon: page.icon,
    keywords: "go to page",
    shortcut: goToShortcut(page),
    action: `go_to_${page.id}`,
    run: () => router.push(page.href)
  }));

  return [
    { key: "actions", label: "Actions", items: actions },
    { key: "deployments", label: "Deployments", items: deployments, emptyQueryLimit: DEPLOYMENTS_WITHOUT_QUERY },
    { key: "pages", label: "Pages", items: pages }
  ];
}

/** The actions and pages scopes reuse the menu's first request instead of searching for deployments no row will show. */
function deploymentsRequestFor({ scope, query }: ParsedQuery) {
  if (scope === "deployments") return { search: query, pageSize: DEPLOYMENTS_IN_SCOPE };
  return { search: scope ? "" : query, pageSize: DEPLOYMENTS_OUTSIDE_SCOPE };
}

function listDeployments(source: DeploymentsListSource, { scope, query }: ParsedQuery) {
  const isClosedShown = !!query || scope === "deployments";
  const listed = isClosedShown ? [...source.active.deployments, ...source.archive.deployments] : source.active.deployments;

  return listed
    .map(deployment => ({ deployment, status: getDeploymentStatus(deployment.state, deployment.leases) }))
    .sort((a, b) => listingRank(a) - listingRank(b) || Number(b.deployment.dseq) - Number(a.deployment.dseq));
}

function listingRank({ deployment, status }: { deployment: ListedDeploymentDto; status: ReturnType<typeof getDeploymentStatus> }) {
  if (status.tone === "running") return 0;
  return deployment.state === "active" ? 1 : 2;
}

function toDeploymentItem({ deployment, status }: ReturnType<typeof listDeployments>[number], open: () => void): CommandItem {
  const dseqLabel = `DSEQ ${deployment.dseq}`;

  return {
    id: `deployment-${deployment.dseq}`,
    label: deployment.name || `Deployment #${deployment.dseq}`,
    keywords: deployment.dseq,
    meta: status.tone === "running" ? dseqLabel : `${dseqLabel} · ${status.label}`,
    isMonospace: true,
    statusDotClassName: DEPLOYMENT_STATUS_DOT_CLASSES[status.tone],
    action: "open_deployment",
    run: open
  };
}
