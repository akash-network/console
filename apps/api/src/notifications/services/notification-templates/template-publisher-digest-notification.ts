import escapeHtml from "lodash/escape";

import type { DigestEntry } from "@src/template-marketplace/lib/publisher-digest/publisher-digest";
import type { InsightHint, InsightHintKind } from "@src/template-marketplace/lib/template-insights/template-insight-hints";
import type { CreateNotificationInput } from "../notification/notification.service";

export type TemplatePublisherDigestVars = {
  organizationId: string;
  /** The last UTC day of the week reported on, which with the organization keeps one digest per week. */
  weekEndsOn: string;
  entries: DigestEntry[];
  templateUrlOf: (templateId: string) => string;
};

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const SHARE_FORMAT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

const WEEK_DAY_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const DAY_MS = 24 * 60 * 60 * 1000;

const HINT_SENTENCES: Record<InsightHintKind, (hint: InsightHint) => string> = {
  few_get_a_provider: ({ value }) =>
    `Only ${SHARE_FORMAT.format(value)} of its deployments got a provider. Asking for fewer resources or raising the price usually helps.`,
  few_still_running: ({ value }) =>
    `Only ${SHARE_FORMAT.format(value)} were still running a day after they got a provider. Check that it starts without extra setup.`,
  latest_version_gets_fewer_providers: ({ value, previousValue, version }) =>
    `Version ${version} gets a provider ${SHARE_FORMAT.format(value)} of the time, against ${SHARE_FORMAT.format(previousValue ?? 0)} for the version before it.`,
  latest_version_stops_more: ({ value, previousValue, version }) =>
    `${SHARE_FORMAT.format(value)} of version ${version}'s deployments kept running a day, against ${SHARE_FORMAT.format(previousValue ?? 0)} for the version before it.`,
  few_viewers_deploy: ({ value }) => `${SHARE_FORMAT.format(value)} of the people who viewed it deployed it. A clearer description may help.`,
  deploys_growing: () => "Deploys are growing.",
  running_well: () => "Deployments made from it keep running."
};

/** Template titles are written by people, so the body escapes each and the headline stays plain text. */
export function templatePublisherDigestNotification(user: { id: string; email: string | null }, vars: TemplatePublisherDigestVars): CreateNotificationInput {
  const deploys = vars.entries.reduce((total, entry) => total + entry.deploys, 0);
  const views = vars.entries.reduce((total, entry) => total + entry.views, 0);

  return {
    notificationId: `templatePublisherDigest.${vars.organizationId}.${vars.weekEndsOn}.${user.id}`,
    payload: {
      summary: `Your templates last week: ${countOf(deploys, "deploy")}, ${countOf(views, "view")}`,
      description:
        `<p>Here is how your public templates did in the week of ${weekLabelOf(vars.weekEndsOn)}.</p>` +
        vars.entries.map(entry => entryParagraph(entry, vars.templateUrlOf(entry.templateId))).join("") +
        "<p>Numbers count mainnet use by people outside your organization.</p>"
    },
    user: { id: user.id, email: user.email }
  };
}

function entryParagraph(entry: DigestEntry, templateUrl: string): string {
  const lines = [
    `<strong>${escapeHtml(entry.title)}</strong>`,
    `${countOf(entry.views, "view")}, ${countOf(entry.deploys, "deploy")} (${changeOf(entry.deploys, entry.previousDeploys)}), ${NUMBER_FORMAT.format(entry.stillRunning)} still running after 24 hours`,
    ...(entry.hint ? [HINT_SENTENCES[entry.hint.kind](entry.hint)] : []),
    `<a href="${escapeHtml(`${templateUrl}?tab=insights`)}">See its insights</a>`
  ];

  return `<p>${lines.join("<br>")}</p>`;
}

function changeOf(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "none the week before either" : "none the week before";

  const change = Math.round(((current - previous) / previous) * 100);

  if (change === 0) return "same as the week before";

  return `${change > 0 ? "+" : "−"}${Math.abs(change)}% vs the week before`;
}

function countOf(count: number, noun: string): string {
  return `${NUMBER_FORMAT.format(count)} ${count === 1 ? noun : `${noun}s`}`;
}

function weekLabelOf(weekEndsOn: string): string {
  const end = Date.parse(`${weekEndsOn}T00:00:00Z`);

  return `${WEEK_DAY_FORMAT.format(end - 6 * DAY_MS)} to ${WEEK_DAY_FORMAT.format(end)}`;
}
