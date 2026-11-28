"use client";
import type { FC } from "react";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useDeploymentCreationQuery } from "@src/queries/useOrganizationActivitiesQuery";
import { DELETED_ACCOUNT_LABEL } from "@src/utils/deletedAccount";
import { formatRelativeTime } from "@src/utils/relativeTime";

export const DEPENDENCIES = { useActiveOrganization, useDeploymentCreationQuery };

export interface DeploymentCreatedByProps {
  dseq: string;
  dependencies?: typeof DEPENDENCIES;
}

/** Names the member who deployed it, which only matters in a team, where any member may have. */
export const DeploymentCreatedBy: FC<DeploymentCreatedByProps> = ({ dseq, dependencies: d = DEPENDENCIES }) => {
  const { activeOrganization } = d.useActiveOrganization();
  const isTeam = activeOrganization?.type === "team";
  const { data: creation } = d.useDeploymentCreationQuery(dseq, { enabled: isTeam });

  if (!isTeam || !creation) return null;

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <span>
        Deployed by{" "}
        {creation.actor ? (
          <strong className="font-semibold text-foreground">{creation.actor.username ?? "a member"}</strong>
        ) : (
          <span className="font-semibold">{DELETED_ACCOUNT_LABEL}</span>
        )}
      </span>
      <span aria-hidden="true">·</span>
      <time dateTime={creation.createdAt}>{formatRelativeTime(creation.createdAt)}</time>
    </p>
  );
};
