import escapeHtml from "lodash/escape";

import type { PublisherNoticeKind } from "@src/template-marketplace/lib/publisher-notice/publisher-notice";
import type { CreateNotificationInput } from "../notification/notification.service";
import { SUPPORT_EMAIL, userReasonParagraph } from "./account-status-email-parts";
import { linkedActions } from "./notification-actions";

export type TemplatePublisherNoticeVars = {
  kind: PublisherNoticeKind;
  /** The moderation event or the version the notice is about, so a retried job repeats no notice. */
  dedupeId: string;
  publisherName: string;
  /** Null for a notice about the publisher rather than one template. */
  templateTitle: string | null;
  versionNumber: number | null;
  reason: string | null;
  /** What the publish checks found, or why a version waits for review. */
  issues: string[];
  templateUrl: string | undefined;
};

type Subject = { title: string; version: string; publisher: string };

type NoticeCopy = {
  category: string;
  headline: (subject: Subject) => string;
  body: (subject: Subject) => string;
  issuesHeading?: string;
  /** A negative outcome states the staff reason and where to ask about it. */
  isNegative: boolean;
  linksToTemplate: boolean;
};

const MAX_TITLE_LENGTH_IN_HEADLINE = 80;

const CURRENT_VERSION_STAYS = "The current version stays the one people deploy.";

const NOTICES: Record<PublisherNoticeKind, NoticeCopy> = {
  version_approved: {
    category: "templateVersionApproved",
    headline: ({ version, title }) => `${version} of ${title} is live`,
    body: ({ version, title }) => `<p>Akash staff reviewed ${version.toLowerCase()} of ${title} and approved it. It's now the version people deploy.</p>`,
    isNegative: false,
    linksToTemplate: true
  },
  version_rejected: {
    category: "templateVersionRejected",
    headline: ({ version, title }) => `${version} of ${title} was not approved`,
    body: ({ version, title }) => `<p>Akash staff reviewed ${version.toLowerCase()} of ${title} and did not approve it. ${CURRENT_VERSION_STAYS}</p>`,
    isNegative: true,
    linksToTemplate: true
  },
  version_failed_checks: {
    category: "templateVersionFailedChecks",
    headline: ({ version, title }) => `${version} of ${title} failed the publish checks`,
    body: ({ version, title }) =>
      `<p>${version} of ${title} was saved, but it failed the checks every version of a public template has to pass, so it did not go live. ${CURRENT_VERSION_STAYS}</p>` +
      "<p>Open the template to fix what the checks found, then save a new version.</p>",
    isNegative: true,
    linksToTemplate: true
  },
  version_held: {
    category: "templateVersionHeld",
    headline: ({ version, title }) => `${version} of ${title} is waiting for review`,
    body: ({ version, title }) =>
      `<p>Akash staff review ${version.toLowerCase()} of ${title} before it goes live. ${CURRENT_VERSION_STAYS}</p>` +
      "<p>You don't need to do anything. We'll let you know once it's reviewed.</p>",
    issuesHeading: "Why it waits for review:",
    isNegative: true,
    linksToTemplate: true
  },
  template_hidden: {
    category: "templateHidden",
    headline: ({ title }) => `${title} was hidden`,
    body: ({ title }) => `<p>Akash staff hid ${title}. It no longer shows in the gallery, and its link only works for members of your organization.</p>`,
    isNegative: true,
    linksToTemplate: true
  },
  template_unhidden: {
    category: "templateUnhidden",
    headline: ({ title }) => `${title} is visible again`,
    body: ({ title }) => `<p>Akash staff made ${title} visible again. It shows in the gallery and its link works for everyone.</p>`,
    isNegative: false,
    linksToTemplate: true
  },
  template_removed: {
    category: "templateRemoved",
    headline: ({ title }) => `${title} was removed`,
    body: ({ title }) =>
      `<p>Akash staff removed ${title}. Its link now says the template was removed, and what it contained was deleted. ` +
      "Deployments already made from it keep running.</p>",
    isNegative: true,
    linksToTemplate: false
  },
  template_promoted_official: {
    category: "templatePromotedOfficial",
    headline: ({ title }) => `${title} is now an Official template`,
    body: ({ title }) => `<p>Akash staff promoted ${title} to Official. It now shows with the Official templates in the gallery.</p>`,
    isNegative: false,
    linksToTemplate: true
  },
  template_removed_official: {
    category: "templateRemovedOfficial",
    headline: ({ title }) => `${title} is no longer an Official template`,
    body: ({ title }) => `<p>Akash staff took ${title} out of the Official templates. It stays public as a community template.</p>`,
    isNegative: true,
    linksToTemplate: true
  },
  publisher_suspended: {
    category: "templatePublisherSuspended",
    headline: ({ publisher }) => `Publishing is suspended for ${publisher}`,
    body: ({ publisher }) =>
      `<p>Akash staff suspended template publishing for ${publisher}. Its public templates are hidden from everyone outside the organization, ` +
      "and it can't make templates public until it's reinstated. Private and organization templates keep working.</p>",
    isNegative: true,
    linksToTemplate: false
  },
  publisher_reinstated: {
    category: "templatePublisherReinstated",
    headline: ({ publisher }) => `${publisher} can publish templates again`,
    body: ({ publisher }) => `<p>Akash staff reinstated template publishing for ${publisher}. Its public templates are visible again.</p>`,
    isNegative: false,
    linksToTemplate: false
  }
};

const CHECK_ISSUES_HEADING = "What the checks found:";

const SUPPORT_PARAGRAPH = `<p>If you think this is a mistake or have questions, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`;

/** Titles, organization names, reasons and check messages are written by people, so the body escapes each and the headline stays plain text. */
export function templatePublisherNotification(user: { id: string; email: string | null }, vars: TemplatePublisherNoticeVars): CreateNotificationInput {
  const copy = NOTICES[vars.kind];
  const version = vars.versionNumber === null ? "A version" : `Version ${vars.versionNumber}`;

  return {
    notificationId: `${copy.category}.${vars.dedupeId}.${user.id}`,
    payload: {
      summary: copy.headline({ version, title: quotedTitleOf(vars.templateTitle), publisher: onOneLine(vars.publisherName) }),
      description:
        copy.body({ version, title: emphasized(vars.templateTitle ?? "your template"), publisher: emphasized(vars.publisherName) }) +
        issuesParagraph(copy.issuesHeading ?? CHECK_ISSUES_HEADING, vars.issues) +
        (copy.isNegative ? userReasonParagraph(vars.reason) + SUPPORT_PARAGRAPH : ""),
      actions: linkedActions({ label: "Open template", url: copy.linksToTemplate ? vars.templateUrl : undefined })
    },
    user: { id: user.id, email: user.email }
  };
}

function emphasized(text: string): string {
  return `<strong>${escapeHtml(text)}</strong>`;
}

function issuesParagraph(heading: string, issues: string[]): string {
  return issues.length > 0 ? `<p><strong>${heading}</strong><br>${issues.map(issue => escapeHtml(issue)).join("<br>")}</p>` : "";
}

function quotedTitleOf(title: string | null): string {
  if (title === null) return "your template";

  const oneLine = onOneLine(title);

  return `"${oneLine.length > MAX_TITLE_LENGTH_IN_HEADLINE ? `${oneLine.slice(0, MAX_TITLE_LENGTH_IN_HEADLINE)}…` : oneLine}"`;
}

function onOneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
