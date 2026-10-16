"use client";
import { useState } from "react";
import { Badge, Button, Progress } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useUser } from "@src/hooks/useUser";
import { useProjectBudgetQuery, useProjectSpendQuery } from "@src/queries/useProjectBudgetQueries";
import { useProjectMembersQuery } from "@src/queries/useProjectMembersQuery";
import type { ProjectBudget, ProjectSpend } from "@src/types/project-budget";
import { ProjectBudgetDialog } from "../ProjectBudgetDialog/ProjectBudgetDialog";
import type { BudgetStanding } from "../projectSpend";
import { budgetAccessFor, budgetStandingOf, budgetUsedPercent, formatSpendUsd, thisMonthSpendRange } from "../projectSpend";
import { SectionLabel } from "../SectionLabel/SectionLabel";

export const DEPENDENCIES = { useActiveOrganization, useUser, useProjectMembersQuery, useProjectBudgetQuery, useProjectSpendQuery, ProjectBudgetDialog };

interface Props {
  projectId: string;
  projectName: string;
  dependencies?: typeof DEPENDENCIES;
}

const STANDING_NOTES: Record<Exclude<BudgetStanding, "within">, string> = {
  "past-alert": "Past the alert threshold.",
  reached: "Budget reached. New deployments in this project are refused until next month or until the budget is raised."
};

/** This month's spend of one project next to its monthly budget; the budget part shows only to the roles the api shares it with. */
export function ProjectBudgetPanel({ projectId, projectName, dependencies: d = DEPENDENCIES }: Props) {
  const { activeOrganization } = d.useActiveOrganization();
  const { user } = d.useUser();
  const organizationRole = activeOrganization?.role;
  const { data: members = [] } = d.useProjectMembersQuery(projectId, { enabled: organizationRole === "member" });
  const projectRole = members.find(member => member.userId === user?.id)?.role;
  const access = budgetAccessFor(organizationRole, projectRole);
  const budgetQuery = d.useProjectBudgetQuery(projectId, { enabled: access.canRead });
  const spendQuery = d.useProjectSpendQuery(thisMonthSpendRange());
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const spend = spendQuery.data?.projects.find(candidate => candidate.projectId === projectId);
  const budget = access.canRead ? budgetQuery.data ?? null : null;
  const committedUsd = budget?.currentPeriod.committedUsd ?? spend?.committedUsd ?? 0;

  return (
    <section aria-label="Spend and budget">
      <SectionLabel rightSlot={<span className="whitespace-nowrap text-xs text-muted-foreground">This month</span>}>Spend and budget</SectionLabel>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {spendQuery.isError ? (
          <p className="px-4 py-5 text-center text-[12.5px] text-muted-foreground">Couldn&apos;t load this project&apos;s spend.</p>
        ) : (
          <div className="space-y-3 px-4 py-3.5">
            <div>
              <p className="font-mono text-xl font-semibold leading-7 tracking-[-0.01em]">{spendQuery.isLoading ? "…" : formatSpendUsd(committedUsd)}</p>
              <p className="text-xs text-muted-foreground">
                {budget ? `committed of ${formatSpendUsd(budget.monthlyAmountUsd)} monthly budget` : "committed this month"}
              </p>
              {budget && spend && spend.committedUsd !== budget.currentPeriod.committedUsd && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Counts deposits recorded since budgets started, so this month it can differ from the spend report.
                </p>
              )}
            </div>

            {budget && <BudgetProgress budget={budget} />}

            {spend && <ConsumedLine spend={spend} />}
          </div>
        )}

        {access.canRead && !budgetQuery.isLoading && <BudgetSettings budget={budget} canManage={access.canManage} onEdit={() => setIsEditingBudget(true)} />}

        <p className="border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          A budget limits new deposits into this project each month and doesn&apos;t set money aside.{" "}
          {budget?.stopTopUps
            ? "Top-ups stop at the budget, so running deployments can run out of funds and close."
            : "Running deployments keep their funding unless top-ups stop at the budget."}
        </p>
      </div>

      {isEditingBudget && <d.ProjectBudgetDialog projectId={projectId} projectName={projectName} budget={budget} onClose={() => setIsEditingBudget(false)} />}
    </section>
  );
}

function BudgetProgress({ budget }: { budget: ProjectBudget }) {
  const standing = budgetStandingOf(budget);
  const usedPercent = Math.floor(budgetUsedPercent(budget));

  return (
    <div className="space-y-1.5">
      <Progress
        value={Math.min(100, usedPercent)}
        aria-label={`${usedPercent}% of the monthly budget committed`}
        className={cn("h-1.5", standing === "reached" && "[&>div]:bg-destructive", standing === "past-alert" && "[&>div]:bg-warning")}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{usedPercent}% used</span>
        <span>Alert at {budget.alertThresholdPercent}%</span>
      </div>
      {standing !== "within" && (
        <p role="status" className={cn("text-xs font-medium", standing === "reached" ? "text-destructive" : "text-foreground")}>
          {STANDING_NOTES[standing]}
        </p>
      )}
    </div>
  );
}

function ConsumedLine({ spend }: { spend: ProjectSpend }) {
  const isEstimated = spend.estimatedConsumedUsd > 0;

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5 text-xs">
      <span className="text-muted-foreground">Consumed this month</span>
      <span className="flex items-center gap-1.5">
        {isEstimated && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10.5px] font-medium" title="Includes lease costs the chain hasn't settled yet">
            Estimated
          </Badge>
        )}
        <span className="font-mono font-medium">{formatSpendUsd(spend.consumedUsd)}</span>
      </span>
    </div>
  );
}

function BudgetSettings({ budget, canManage, onEdit }: { budget: ProjectBudget | null; canManage: boolean; onEdit: () => void }) {
  if (!budget) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-xs text-muted-foreground">{canManage ? "No monthly budget." : "No monthly budget. An owner or admin can set one."}</span>
        {canManage && (
          <Button variant="outline" size="sm" className="text-xs" onClick={onEdit}>
            Set budget
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <span className="text-xs text-muted-foreground">{budget.stopTopUps ? "Top-ups stop at the budget." : "Top-ups continue past the budget."}</span>
      {canManage && (
        <Button variant="outline" size="sm" className="text-xs" onClick={onEdit}>
          Edit budget
        </Button>
      )}
    </div>
  );
}
