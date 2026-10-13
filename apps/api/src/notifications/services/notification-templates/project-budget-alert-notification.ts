import escapeHtml from "lodash/escape";

import type { UserOutput } from "@src/user/repositories";
import type { CreateNotificationInput } from "../notification/notification.service";

export type ProjectBudgetAlertVars = {
  projectId: string;
  projectName: string;
  period: string;
  committedUsd: number;
  budgetUsd: number;
  refusedUsd: number;
  stopTopUps: boolean;
  projectUrl: string;
};

/** A project name is whatever a member typed, so it is escaped before going into the markup; the summary stays plain text, which the email layout escapes. */
export function projectBudgetAlertNotification(user: UserOutput, vars: ProjectBudgetAlertVars): CreateNotificationInput {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const percent = Math.floor((vars.committedUsd * 100) / vars.budgetUsd);
  const refusal =
    vars.refusedUsd > 0 ? ` A deposit of <strong>${formatter.format(vars.refusedUsd)}</strong> was not signed because it would have gone past the budget.` : "";
  const runningDeployments = vars.stopTopUps ? "Top-ups of its running deployments stop at the budget too." : "Its running deployments keep being topped up.";

  return {
    notificationId: `projectBudgetAlert.${vars.projectId}.${vars.period}.${user.id}`,
    payload: {
      summary: `Project ${vars.projectName} has committed ${percent}% of its monthly budget`,
      description:
        `Deposits committed for <strong>${escapeHtml(vars.projectName)}</strong> this month total <strong>${formatter.format(vars.committedUsd)}</strong> ` +
        `of its <strong>${formatter.format(vars.budgetUsd)}</strong> monthly budget.${refusal} ` +
        `New deployments in this project are refused once a deposit would go past the budget. ${runningDeployments} ` +
        `An owner or admin can change the budget.`,
      actions: [{ label: "View project", url: vars.projectUrl }]
    },
    user: { id: user.id, email: user.email }
  };
}
