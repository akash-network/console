import { describe, expect, it } from "vitest";

import { buildUserBlockSlackMessage, USER_BLOCK_HEADLINE } from "./user-block-slack-message";

describe(buildUserBlockSlackMessage.name, () => {
  it("describes an automatic block with its flagged turns, its end and a link to admin", () => {
    const message = buildUserBlockSlackMessage({
      block: { source: "automatic", blockedUntil: new Date("2026-11-05T00:00:00.000Z"), flaggedTurnCount: 3 },
      adminConversationsUrl: "https://admin.example.com/assistant/conversations?userId=u1"
    });

    expect(message).toEqual({
      text: [
        USER_BLOCK_HEADLINE,
        "automatic block · 3 flagged turns today · until 2026-11-05 00:00 UTC",
        "<https://admin.example.com/assistant/conversations?userId=u1|Open in admin>"
      ].join("\n")
    });
  });

  it("describes a permanent block without a flagged turn count or admin link", () => {
    const message = buildUserBlockSlackMessage({
      block: { source: "admin", blockedUntil: null, flaggedTurnCount: null },
      adminConversationsUrl: undefined
    });

    expect(message).toEqual({ text: [USER_BLOCK_HEADLINE, "admin block · permanently"].join("\n") });
  });
});
