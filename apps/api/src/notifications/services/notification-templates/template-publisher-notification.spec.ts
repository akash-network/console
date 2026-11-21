import { describe, expect, it } from "vitest";

import { PUBLISHER_NOTICE_KINDS, type PublisherNoticeKind } from "@src/template-marketplace/lib/publisher-notice/publisher-notice";
import { type TemplatePublisherNoticeVars, templatePublisherNotification } from "./template-publisher-notification";

const USER = { id: "user-1", email: "owner@example.com" };
const TEMPLATE_URL = "https://console.akash.network/template/template-1";
const REASON = "<p><strong>Reason:</strong> It mines cryptocurrency.</p>";
const SUPPORT = '<p>If you think this is a mistake or have questions, email <a href="mailto:support@akash.network">support@akash.network</a>.</p>';
const OPEN_TEMPLATE = [{ label: "Open template", url: TEMPLATE_URL }];
const TITLE = "<strong>Postgres 16</strong>";
const PUBLISHER = "<strong>Acme Cloud</strong>";
const CURRENT_STAYS = "The current version stays the one people deploy.";

type Expected = { category: string; summary: string; description: string; actions: typeof OPEN_TEMPLATE | undefined };

const EXPECTED: Record<PublisherNoticeKind, Expected> = {
  version_approved: {
    category: "templateVersionApproved",
    summary: 'Version 3 of "Postgres 16" is live',
    description: `<p>Akash staff reviewed version 3 of ${TITLE} and approved it. It's now the version people deploy.</p>`,
    actions: OPEN_TEMPLATE
  },
  version_rejected: {
    category: "templateVersionRejected",
    summary: 'Version 3 of "Postgres 16" was not approved',
    description: `<p>Akash staff reviewed version 3 of ${TITLE} and did not approve it. ${CURRENT_STAYS}</p>${REASON}${SUPPORT}`,
    actions: OPEN_TEMPLATE
  },
  version_failed_checks: {
    category: "templateVersionFailedChecks",
    summary: 'Version 3 of "Postgres 16" failed the publish checks',
    description:
      `<p>Version 3 of ${TITLE} was saved, but it failed the checks every version of a public template has to pass, so it did not go live. ${CURRENT_STAYS}</p>` +
      `<p>Open the template to fix what the checks found, then save a new version.</p>${REASON}${SUPPORT}`,
    actions: OPEN_TEMPLATE
  },
  version_held: {
    category: "templateVersionHeld",
    summary: 'Version 3 of "Postgres 16" is waiting for review',
    description:
      `<p>Version 3 of ${TITLE} changes what a widely used template runs, so Akash staff review it before it goes live. ${CURRENT_STAYS}</p>` +
      `<p>You don't need to do anything. We'll let you know once it's reviewed.</p>${REASON}${SUPPORT}`,
    actions: OPEN_TEMPLATE
  },
  template_hidden: {
    category: "templateHidden",
    summary: '"Postgres 16" was hidden',
    description: `<p>Akash staff hid ${TITLE}. It no longer shows in the gallery, and its link only works for members of your organization.</p>${REASON}${SUPPORT}`,
    actions: OPEN_TEMPLATE
  },
  template_unhidden: {
    category: "templateUnhidden",
    summary: '"Postgres 16" is visible again',
    description: `<p>Akash staff made ${TITLE} visible again. It shows in the gallery and its link works for everyone.</p>`,
    actions: OPEN_TEMPLATE
  },
  template_removed: {
    category: "templateRemoved",
    summary: '"Postgres 16" was removed',
    description:
      `<p>Akash staff removed ${TITLE}. Its link now says the template was removed, and what it contained was deleted. ` +
      `Deployments already made from it keep running.</p>${REASON}${SUPPORT}`,
    actions: undefined
  },
  template_promoted_official: {
    category: "templatePromotedOfficial",
    summary: '"Postgres 16" is now an Official template',
    description: `<p>Akash staff promoted ${TITLE} to Official. It now shows with the Official templates in the gallery.</p>`,
    actions: OPEN_TEMPLATE
  },
  template_removed_official: {
    category: "templateRemovedOfficial",
    summary: '"Postgres 16" is no longer an Official template',
    description: `<p>Akash staff took ${TITLE} out of the Official templates. It stays public as a community template.</p>${REASON}${SUPPORT}`,
    actions: OPEN_TEMPLATE
  },
  publisher_suspended: {
    category: "templatePublisherSuspended",
    summary: "Publishing is suspended for Acme Cloud",
    description:
      `<p>Akash staff suspended template publishing for ${PUBLISHER}. Its public templates are hidden from everyone outside the organization, ` +
      `and it can't make templates public until it's reinstated. Private and organization templates keep working.</p>${REASON}${SUPPORT}`,
    actions: undefined
  },
  publisher_reinstated: {
    category: "templatePublisherReinstated",
    summary: "Acme Cloud can publish templates again",
    description: `<p>Akash staff reinstated template publishing for ${PUBLISHER}. Its public templates are visible again.</p>`,
    actions: undefined
  }
};

describe(templatePublisherNotification.name, () => {
  it.each(PUBLISHER_NOTICE_KINDS)("words a %s notice, keyed on what it is about and who it goes to", kind => {
    const result = templatePublisherNotification(USER, varsOf({ kind }));

    expect(result).toEqual({
      notificationId: `${EXPECTED[kind].category}.event-1.user-1`,
      payload: { summary: EXPECTED[kind].summary, description: EXPECTED[kind].description, actions: EXPECTED[kind].actions },
      user: USER
    });
  });

  it("lists what the checks found, each on its own line, before the support contact", () => {
    const result = templatePublisherNotification(
      USER,
      varsOf({ kind: "version_failed_checks", reason: null, issues: ["The SDL sets a secret in plain text.", "The image has no tag."] })
    );

    expect(result.payload.description).toContain(
      "then save a new version.</p><p><strong>What the checks found:</strong><br>The SDL sets a secret in plain text.<br>The image has no tag.</p>" + SUPPORT
    );
  });

  it("leaves the list of findings out when there are none", () => {
    const result = templatePublisherNotification(USER, varsOf({ kind: "version_failed_checks", issues: [] }));

    expect(result.payload.description).not.toContain("What the checks found");
  });

  it("leaves the reason out of a negative outcome that has none, and keeps the support contact", () => {
    const result = templatePublisherNotification(USER, varsOf({ kind: "template_hidden", reason: null }));

    expect(result.payload.description).not.toContain("Reason:");
    expect(result.payload.description).toContain(SUPPORT);
  });

  it("keeps a staff reason out of a notice of good news", () => {
    const result = templatePublisherNotification(USER, varsOf({ kind: "template_unhidden", reason: "Appeal accepted" }));

    expect(result.payload.description).not.toContain("Appeal accepted");
    expect(result.payload.description).not.toContain("support@akash.network");
  });

  it("renders nothing a person wrote as HTML", () => {
    const markup = '<img src=x onerror="alert(1)"><a href="https://evil.example">win</a> & [free](https://evil.example)';
    const result = templatePublisherNotification(
      USER,
      varsOf({ kind: "version_failed_checks", templateTitle: markup, reason: `${markup}!`, issues: [`${markup}?`] })
    );
    const escaped =
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;a href=&quot;https://evil.example&quot;&gt;win&lt;/a&gt; &amp; [free](https://evil.example)";

    expect(result.payload.description).toContain(`<p>Version 3 of <strong>${escaped}</strong> was saved`);
    expect(result.payload.description).toContain(`<br>${escaped}?</p>`);
    expect(result.payload.description).toContain(`<p><strong>Reason:</strong> ${escaped}!</p>`);
    expect(result.payload.description.replaceAll(escaped, "")).not.toMatch(/<(?!\/?(p|strong|br)>|a href="mailto:support@akash\.network">|\/a>)/);
    expect(result.payload.summary).toBe(`Version 3 of "${markup.slice(0, 80)}…" failed the publish checks`);
  });

  it("escapes markup in the name of the publishing organization", () => {
    const result = templatePublisherNotification(USER, varsOf({ kind: "publisher_reinstated", publisherName: "<b>Acme</b>" }));

    expect(result.payload.description).toContain("for <strong>&lt;b&gt;Acme&lt;/b&gt;</strong>.");
  });

  it("keeps a title with line breaks on one line of the headline", () => {
    const result = templatePublisherNotification(
      USER,
      varsOf({ kind: "template_hidden", templateTitle: "  Postgres\r\n16\t\n", publisherName: " Acme \n Cloud " })
    );
    const suspended = templatePublisherNotification(USER, varsOf({ kind: "publisher_suspended", publisherName: " Acme \n Cloud " }));

    expect(result.payload.summary).toBe('"Postgres 16" was hidden');
    expect(suspended.payload.summary).toBe("Publishing is suspended for Acme Cloud");
  });

  it("keeps a title of exactly the headline's length whole and cuts a longer one", () => {
    const atLimit = "a".repeat(80);

    expect(templatePublisherNotification(USER, varsOf({ kind: "template_hidden", templateTitle: atLimit })).payload.summary).toBe(`"${atLimit}" was hidden`);
    expect(templatePublisherNotification(USER, varsOf({ kind: "template_hidden", templateTitle: `${atLimit}b` })).payload.summary).toBe(
      `"${atLimit}…" was hidden`
    );
  });

  it("speaks of a template and a version it cannot name without inventing either", () => {
    const result = templatePublisherNotification(USER, varsOf({ kind: "version_approved", templateTitle: null, versionNumber: null }));

    expect(result.payload.summary).toBe("A version of your template is live");
    expect(result.payload.description).toBe(
      "<p>Akash staff reviewed a version of <strong>your template</strong> and approved it. It's now the version people deploy.</p>"
    );
  });

  it("sends no link when the template's page address is unknown", () => {
    const result = templatePublisherNotification(USER, varsOf({ kind: "version_approved", templateUrl: undefined }));

    expect(result.payload.actions).toBeUndefined();
  });

  function varsOf(overrides: Partial<TemplatePublisherNoticeVars> & Pick<TemplatePublisherNoticeVars, "kind">): TemplatePublisherNoticeVars {
    return {
      dedupeId: "event-1",
      publisherName: "Acme Cloud",
      templateTitle: "Postgres 16",
      versionNumber: 3,
      reason: "It mines cryptocurrency.",
      issues: [],
      templateUrl: TEMPLATE_URL,
      ...overrides
    };
  }
});
