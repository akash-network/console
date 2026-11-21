import { describe, expect, it } from "vitest";

import type { PublishCheck, PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import { templateModerationActionEnum } from "@src/template-marketplace/model-schemas/template-moderation-event/template-moderation-event.schema";
import { failedCheckMessagesOf, holdReasonMessagesOf, MAX_ISSUES_IN_NOTICE, publisherNoticeKindOf } from "./publisher-notice";

describe(publisherNoticeKindOf.name, () => {
  it("names the notice of each staff action a publisher is told about, and none for the rest", () => {
    const kinds = Object.fromEntries(templateModerationActionEnum.enumValues.map(action => [action, publisherNoticeKindOf(action)]));

    expect(kinds).toEqual({
      hide: "template_hidden",
      unhide: "template_unhidden",
      remove: "template_removed",
      approve_version: "version_approved",
      reject_version: "version_rejected",
      rollback_version: undefined,
      promote_official: "template_promoted_official",
      remove_official: "template_removed_official",
      feature: undefined,
      unfeature: undefined,
      edit_categories: undefined,
      accept_image_change: undefined,
      suspend_publisher: "publisher_suspended",
      reinstate_publisher: "publisher_reinstated",
      verify_publisher: undefined,
      unverify_publisher: undefined
    });
  });
});

describe(failedCheckMessagesOf.name, () => {
  it("lists what the failed checks said, in the order the checks ran", () => {
    const results = resultsOf([
      { key: "sdl_valid", status: "failed", issues: [{ message: "The SDL is invalid." }] },
      { key: "no_secrets", status: "passed", issues: [] },
      { key: "text_within_limits", status: "failed", issues: [{ message: "Title is too long.", field: "title" }, { message: "Summary is too long." }] }
    ]);

    expect(failedCheckMessagesOf(results)).toEqual(["The SDL is invalid.", "Title is too long.", "Summary is too long."]);
  });

  it("leaves out what a passed check noted", () => {
    const results = resultsOf([{ key: "sdl_valid", status: "passed", issues: [{ message: "Only a note." }] }]);

    expect(failedCheckMessagesOf(results)).toEqual([]);
  });

  it("lists nothing for a version that was never checked", () => {
    expect(failedCheckMessagesOf(null)).toEqual([]);
  });

  it("lists every message of a list just short enough to fit", () => {
    const messages = Array.from({ length: MAX_ISSUES_IN_NOTICE }, (_, index) => `Issue ${index + 1}`);

    expect(failedCheckMessagesOf(resultsOf([{ key: "sdl_valid", status: "failed", issues: messages.map(message => ({ message })) }]))).toEqual(messages);
  });

  it("cuts a longer list and says how many more there are", () => {
    const messages = Array.from({ length: MAX_ISSUES_IN_NOTICE + 2 }, (_, index) => `Issue ${index + 1}`);

    expect(failedCheckMessagesOf(resultsOf([{ key: "sdl_valid", status: "failed", issues: messages.map(message => ({ message })) }]))).toEqual([
      "Issue 1",
      "Issue 2",
      "Issue 3",
      "Issue 4",
      "Issue 5",
      "And 2 more."
    ]);
  });

  function resultsOf(checks: PublishCheck[]): PublishCheckResults {
    return { ranAt: "2026-11-18T00:00:00.000Z", checks };
  }
});

describe(holdReasonMessagesOf.name, () => {
  it("lists why the version waits, in the order the reasons were found", () => {
    const messages = holdReasonMessagesOf([
      { kind: "official_template", message: "Official templates are always reviewed." },
      { kind: "global_port_added", message: "Opens port 22.", service: "web", port: 22, protocol: "tcp" }
    ]);

    expect(messages).toEqual(["Official templates are always reviewed.", "Opens port 22."]);
  });

  it("lists nothing for a version that never waited", () => {
    expect(holdReasonMessagesOf(null)).toEqual([]);
    expect(holdReasonMessagesOf([])).toEqual([]);
  });

  it("cuts a long list and says how many more there are", () => {
    const reasons = Array.from({ length: MAX_ISSUES_IN_NOTICE + 1 }, (_, index) => ({ kind: "global_port_added" as const, message: `Reason ${index + 1}` }));

    expect(holdReasonMessagesOf(reasons)).toEqual(["Reason 1", "Reason 2", "Reason 3", "Reason 4", "Reason 5", "And 1 more."]);
  });
});
