import { describe, expect, it } from "vitest";

import { buildProblemReportSlackMessage, PROBLEM_REPORT_HEADLINE } from "./problem-report-slack-message";

const ADMIN_CONVERSATION_URL = "https://console-admin.example.com/assistant/conversations/5b0e8f1c-2d3a-4b5c-8d6e-7f8091a2b3c4";

describe(buildProblemReportSlackMessage.name, () => {
  it("names what is attached, the reported turn's outcome and model, and links the conversation in admin", () => {
    const message = buildProblemReportSlackMessage({
      report: { note: "secret note", transcript: [{ role: "user", content: "secret question" }] },
      turn: { id: "turn-1", outcome: "fallback", model: "zai-org/GLM-5.3" },
      adminConversationUrl: ADMIN_CONVERSATION_URL
    });

    expect(message.text.split("\n")).toEqual([
      PROBLEM_REPORT_HEADLINE,
      "Transcript: attached · Note: attached",
      "Reported turn: fallback · zai-org/GLM-5.3",
      `<${ADMIN_CONVERSATION_URL}|Open in admin>`
    ]);
    expect(PROBLEM_REPORT_HEADLINE).toBe(":triangular_flag_on_post: *Assistant problem report*");
  });

  it("never carries the note or the transcript", () => {
    const message = buildProblemReportSlackMessage({
      report: { note: "my note text", transcript: [{ role: "user", content: "my question text" }] },
      turn: undefined,
      adminConversationUrl: undefined
    });

    expect(message.text).not.toContain("my note text");
    expect(message.text).not.toContain("my question text");
  });

  it("says a stored conversation's transcript lives with the conversation, and when no note or turn came with the report", () => {
    const message = buildProblemReportSlackMessage({ report: { note: null, transcript: null }, turn: undefined, adminConversationUrl: undefined });

    expect(message.text.split("\n")).toEqual([PROBLEM_REPORT_HEADLINE, "Transcript: stored conversation · Note: none", "Reported turn: unknown"]);
  });

  it("escapes Slack markup in the model name", () => {
    const message = buildProblemReportSlackMessage({
      report: { note: null, transcript: [] },
      turn: { id: "turn-1", outcome: "answered", model: "<model>&co" },
      adminConversationUrl: undefined
    });

    expect(message.text.split("\n")[2]).toBe("Reported turn: answered · &lt;model&gt;&amp;co");
  });
});
