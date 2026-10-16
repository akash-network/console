"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import type { OrganizationOutput } from "@src/types/organization";
import { ORGANIZATION_ROLE_LABELS } from "../organizationAccess";
import { OrganizationAvatar } from "../OrganizationAvatar/OrganizationAvatar";

export const DEPENDENCIES = { useActiveOrganization };

type Props = {
  dependencies?: typeof DEPENDENCIES;
  /** "header" keeps the trigger compact on phones; "sheet" fills the width of the mobile navigation sheet. */
  layout?: "header" | "sheet";
  /** Adds the "Create organization" row and shows the switcher without a team; headers that cannot host the dialog leave it out. */
  onCreateOrganization?: () => void;
  /** Called after a selection so a surrounding sheet can close. */
  onNavigate?: () => void;
};

const TRIGGER_CLASSES =
  "inline-flex h-9 shrink-0 items-center gap-1 rounded-[9px] border border-border bg-background px-1.5 text-[13.5px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted sm:gap-2 sm:pl-1.5 sm:pr-2.5";

const SECTION_LABEL_CLASSES = "px-[9px] pb-[5px] pt-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground";

const ROW_CLASSES = "min-h-9 cursor-pointer gap-2.5 rounded-[7px] px-[9px] py-0 text-[13.5px] font-medium focus:bg-muted focus:text-foreground";

const NO_TEAMS_MESSAGE = "You're not in any organizations yet. Create one to share projects, deployments and billing with your team.";

export function OrganizationSwitcher({ dependencies: d = DEPENDENCIES, layout = "header", onCreateOrganization, onNavigate }: Props) {
  const { organizations, activeOrganization, switchOrganization } = d.useActiveOrganization();
  const personalOrganization = organizations.find(organization => organization.type === "personal");
  const teamOrganizations = organizations.filter(organization => organization.type === "team");
  const hasTeams = teamOrganizations.length > 0;

  if (!activeOrganization || (!hasTeams && !onCreateOrganization)) return null;

  const select = (organization: OrganizationOutput) => {
    if (organization.id !== activeOrganization.id) switchOrganization(organization.id);
    onNavigate?.();
  };

  const renderRow = (organization: OrganizationOutput) => {
    const isCurrent = organization.id === activeOrganization.id;
    return (
      <DropdownMenuItem key={organization.id} role="menuitemradio" aria-checked={isCurrent} className={ROW_CLASSES} onSelect={() => select(organization)}>
        <OrganizationAvatar organization={organization} size={20} />
        <span className="min-w-0 flex-1 truncate">{organization.name}</span>
        {organization.type === "team" && (
          <span className="shrink-0 text-xs font-normal text-muted-foreground">{ORGANIZATION_ROLE_LABELS[organization.role]}</span>
        )}
        <span className="inline-flex w-3.5 shrink-0 justify-center">{isCurrent && <Check className="h-3.5 w-3.5" />}</span>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger aria-label={`${activeOrganization.name}, switch organization`} className={cn(TRIGGER_CLASSES, layout === "sheet" && "w-full")}>
        <OrganizationAvatar organization={activeOrganization} size={22} />
        <span className={cn("truncate", layout === "header" ? "hidden max-w-[180px] sm:block" : "min-w-0 flex-1 text-left")}>{activeOrganization.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={layout === "sheet" ? "start" : "end"}
        sideOffset={6}
        collisionPadding={8}
        className="organization-switcher-menu w-[292px] max-w-[calc(100vw-1rem)] rounded-[11px] p-[5px] shadow-[0_16px_38px_-12px_rgba(0,0,0,0.28)]"
      >
        <DropdownMenuLabel className={SECTION_LABEL_CLASSES}>Personal account</DropdownMenuLabel>
        {personalOrganization && renderRow(personalOrganization)}
        <DropdownMenuLabel className={SECTION_LABEL_CLASSES}>Organizations</DropdownMenuLabel>
        {hasTeams ? (
          teamOrganizations.map(renderRow)
        ) : (
          <p className="text-pretty px-[9px] pb-[9px] pt-px text-[12.5px] leading-[18px] text-muted-foreground">{NO_TEAMS_MESSAGE}</p>
        )}
        {onCreateOrganization && (
          <>
            <DropdownMenuSeparator className="my-[5px] bg-border" />
            <DropdownMenuItem
              className={ROW_CLASSES}
              onSelect={() => {
                onCreateOrganization();
                onNavigate?.();
              }}
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <Plus className="h-[15px] w-[15px] text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1 truncate">Create organization</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
