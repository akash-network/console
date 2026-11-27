import escapeHtml from "lodash/escape";

import type { CreateNotificationInput } from "../notification/notification.service";
import { linkedActions } from "./notification-actions";

export type TemplateMilestoneVars = {
  templateId: string;
  templateTitle: string;
  milestone: number;
  templateUrl: string;
};

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const MAX_TITLE_LENGTH_IN_HEADLINE = 80;

/** The title is written by people, so the body escapes it and the headline stays plain text. */
export function templateMilestoneNotification(user: { id: string; email: string | null }, vars: TemplateMilestoneVars): CreateNotificationInput {
  const milestone = NUMBER_FORMAT.format(vars.milestone);

  return {
    notificationId: `templateMilestone.${vars.templateId}.${vars.milestone}.${user.id}`,
    payload: {
      summary: `"${headlineTitleOf(vars.templateTitle)}" passed ${milestone} deploys`,
      description:
        `<p>People outside your organization have now deployed <strong>${escapeHtml(vars.templateTitle)}</strong> ${milestone} times on mainnet. ` +
        "Thanks for publishing it.</p><p>Its Insights tab shows how people find it and how long their deployments keep running.</p>",
      actions: linkedActions({ label: "See insights", url: `${vars.templateUrl}?tab=insights` })
    },
    user: { id: user.id, email: user.email }
  };
}

function headlineTitleOf(title: string): string {
  const oneLine = title.replace(/\s+/g, " ").trim();

  return oneLine.length > MAX_TITLE_LENGTH_IN_HEADLINE ? `${oneLine.slice(0, MAX_TITLE_LENGTH_IN_HEADLINE)}…` : oneLine;
}
