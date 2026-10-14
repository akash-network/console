"use client";
import { Eye, FolderLock } from "lucide-react";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";

export const DEPENDENCIES = { useActiveOrganization };

export type ViewOnlyReason = "no_projects" | "view_only";

interface Props {
  reason: ViewOnlyReason;
  dependencies?: typeof DEPENDENCIES;
}

/** Stands in for a deploy prompt the caller could not act on, and says who can change that. */
export function ViewOnlyNotice({ reason, dependencies: d = DEPENDENCIES }: Props) {
  const { activeOrganization } = d.useActiveOrganization();
  const Icon = reason === "no_projects" ? FolderLock : Eye;

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      {reason === "no_projects" ? (
        <>
          <h2 className="text-xl font-semibold text-foreground">No projects to show</h2>
          <p className="max-w-md text-[13.5px] text-muted-foreground">You don&apos;t have access to any project yet. Ask an owner or admin.</p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-foreground">You have view-only access</h2>
          <p className="max-w-md text-[13.5px] text-muted-foreground">
            You can see deployments here but not create, close or fund them. Ask an owner or admin of {activeOrganization?.name ?? "your organization"} if you
            need more access.
          </p>
        </>
      )}
    </div>
  );
}
