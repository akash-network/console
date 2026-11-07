import { describe, expect, it } from "vitest";

import {
  decideSentiment,
  decideStuck,
  decideTheme,
  decideType,
  ENDED_STUCK_QUESTION_ID,
  ITEM_QUESTIONS,
  itemStateOf,
  MIN_NOT_STUCK_PROBABILITY,
  MIN_STUCK_PROBABILITY,
  MIN_THEME_MATCH_PROBABILITY,
  MIN_TYPE_PROBABILITY,
  NOT_STUCK_QUESTION_ID,
  SENTIMENT_QUESTION_ID,
  stuckFactOf,
  TEXT_SENTIMENT_WEIGHT_WITH_RATING,
  themeQuestionsFor,
  themeStateOf,
  TYPE_PRIORITY,
  typeQuestionId
} from "./feedback-jev-judgments";

const CANDIDATES = [
  { id: "theme-a", title: "Empty logs", summary: "The logs tab shows nothing" },
  { id: "theme-b", title: "Logs missing", summary: null },
  { id: "theme-c", title: "Shell drops", summary: "The shell disconnects" }
];

function typeValues(probabilities: Partial<Record<(typeof TYPE_PRIORITY)[number], number>>): Record<string, number> {
  return Object.fromEntries(TYPE_PRIORITY.map(type => [typeQuestionId(type), probabilities[type] ?? 0]));
}

describe("ITEM_QUESTIONS", () => {
  it("asks one Noul per type, a sentiment Score and two stuck Nouls", () => {
    expect(Object.keys(ITEM_QUESTIONS)).toEqual([
      "type_bug",
      "type_ux_friction",
      "type_feature_request",
      "type_support_question",
      SENTIMENT_QUESTION_ID,
      ENDED_STUCK_QUESTION_ID,
      NOT_STUCK_QUESTION_ID
    ]);
    expect(TYPE_PRIORITY.map(type => ITEM_QUESTIONS[typeQuestionId(type)].type)).toEqual(["noul", "noul", "noul", "noul"]);
    expect(ITEM_QUESTIONS[SENTIMENT_QUESTION_ID]).toMatchObject({ type: "score", criteria: expect.arrayContaining([expect.stringMatching(/^Very negative/)]) });
    expect(ITEM_QUESTIONS[ENDED_STUCK_QUESTION_ID].type).toBe("noul");
    expect(ITEM_QUESTIONS[NOT_STUCK_QUESTION_ID].type).toBe("noul");
  });
});

describe(itemStateOf.name, () => {
  it("names the product and passes the item without its star rating", () => {
    expect(itemStateOf({ source: "general", rating: 2, message: "logs never load" })).toEqual({
      product: "Akash Console, a web app for deploying workloads on the Akash Network",
      feedback: { source: "general", message: "logs never load" }
    });
  });
});

describe(decideType.name, () => {
  it("files an item under the one type that clears the threshold", () => {
    expect(decideType(typeValues({ feature_request: MIN_TYPE_PROBABILITY, bug: MIN_TYPE_PROBABILITY - 0.01 }))).toEqual({
      type: "feature_request",
      cleared: ["feature_request"],
      rule: "only_type_cleared"
    });
  });

  it("files a mixed item under the first type in priority order", () => {
    expect(decideType(typeValues({ support_question: 0.99, feature_request: 0.98, ux_friction: MIN_TYPE_PROBABILITY }))).toEqual({
      type: "ux_friction",
      cleared: ["ux_friction", "feature_request", "support_question"],
      rule: "priority_order"
    });
  });

  it("leaves an item no type clears as not actionable", () => {
    expect(decideType(typeValues({ bug: MIN_TYPE_PROBABILITY - 0.01 }))).toEqual({ type: null, cleared: [], rule: "no_type_cleared" });
  });

  it("keeps the provisional priority bug, ux friction, feature request, support question", () => {
    expect(TYPE_PRIORITY).toEqual(["bug", "ux_friction", "feature_request", "support_question"]);
  });
});

describe(decideSentiment.name, () => {
  it.each([
    { level: 0, sentimentScore: -1 },
    { level: 2, sentimentScore: 0 },
    { level: 3, sentimentScore: 0.5 },
    { level: 4, sentimentScore: 1 }
  ])("maps sentiment level $level onto $sentimentScore when there is no rating", ({ level, sentimentScore }) => {
    expect(decideSentiment(level, null)).toEqual({ sentimentScore, rule: "text_only" });
  });

  it("weighs the text against the star rating", () => {
    expect(decideSentiment(4, 1)).toEqual({
      sentimentScore: TEXT_SENTIMENT_WEIGHT_WITH_RATING * 1 + (1 - TEXT_SENTIMENT_WEIGHT_WITH_RATING) * -1,
      rule: "text_and_rating"
    });
    expect(decideSentiment(2, 5).sentimentScore).toBeCloseTo(1 - TEXT_SENTIMENT_WEIGHT_WITH_RATING);
  });
});

describe(stuckFactOf.name, () => {
  it.each([
    { resolvedByUser: true, endedStuck: false },
    { resolvedByUser: false, endedStuck: true }
  ])("settles a conversation the user marked resolved $resolvedByUser", ({ resolvedByUser, endedStuck }) => {
    expect(stuckFactOf({ resolvedByUser, messages: [{ role: "user", content: "help" }] })).toEqual({ endedStuck, rule: "resolved_by_user" });
  });

  it("counts a final question the assistant never answered as stuck", () => {
    const messages = [
      { role: "user" as const, content: "deploy llama" },
      { role: "assistant" as const, content: "here it is" },
      { role: "user" as const, content: "and a gpu?" },
      { role: "tool" as const, content: "read templates" }
    ];

    expect(stuckFactOf({ resolvedByUser: null, messages })).toEqual({ endedStuck: true, rule: "final_turn_unanswered" });
  });

  it("counts a question asked after the assistant's greeting and never answered as stuck", () => {
    const messages = [
      { role: "assistant" as const, content: "hi" },
      { role: "user" as const, content: "deploy llama" }
    ];

    expect(stuckFactOf({ resolvedByUser: null, messages })).toEqual({ endedStuck: true, rule: "final_turn_unanswered" });
  });

  it.each([
    {
      name: "an answered conversation",
      messages: [
        { role: "user" as const, content: "help" },
        { role: "assistant" as const, content: "sure" }
      ]
    },
    {
      name: "an answered conversation that ends on a tool result",
      messages: [
        { role: "user" as const, content: "help" },
        { role: "assistant" as const, content: "sure" },
        { role: "tool" as const, content: "read logs" }
      ]
    },
    {
      name: "a conversation the user never wrote in",
      messages: [
        { role: "assistant" as const, content: "hi" },
        { role: "tool" as const, content: "read balance" }
      ]
    }
  ])("leaves $name to judgment", ({ messages }) => {
    expect(stuckFactOf({ resolvedByUser: null, messages })).toBeNull();
  });
});

describe(decideStuck.name, () => {
  it.each([
    { stuck: MIN_STUCK_PROBABILITY, notStuck: 0, expected: { endedStuck: true, rule: "judged_stuck" } },
    { stuck: 0, notStuck: MIN_NOT_STUCK_PROBABILITY, expected: { endedStuck: false, rule: "judged_not_stuck" } },
    { stuck: MIN_STUCK_PROBABILITY, notStuck: MIN_NOT_STUCK_PROBABILITY, expected: { endedStuck: null, rule: "judgments_conflict" } },
    { stuck: MIN_STUCK_PROBABILITY - 0.01, notStuck: MIN_NOT_STUCK_PROBABILITY - 0.01, expected: { endedStuck: null, rule: "judgment_unsure" } }
  ])("decides $expected.rule when stuck is $stuck and not stuck is $notStuck", ({ stuck, notStuck, expected }) => {
    expect(decideStuck(stuck, notStuck)).toEqual(expected);
  });
});

describe(themeStateOf.name, () => {
  it("passes only the item's type and summary", () => {
    expect(themeStateOf({ type: "bug", summary: "Logs page stays empty" })).toEqual({
      product: "Akash Console, a web app for deploying workloads on the Akash Network",
      feedback_item: { type: "bug", summary: "Logs page stays empty" }
    });
  });
});

describe(themeQuestionsFor.name, () => {
  it("asks one same-problem Noul per candidate theme, keyed by its position", () => {
    expect(themeQuestionsFor(CANDIDATES.slice(0, 2))).toEqual({
      theme_0: {
        type: "noul",
        instructions: {
          theme: { title: "Empty logs", summary: "The logs tab shows nothing" },
          question: "Does `feedback_item` describe the same underlying problem or request as `theme`?"
        }
      },
      theme_1: {
        type: "noul",
        instructions: {
          theme: { title: "Logs missing", summary: undefined },
          question: "Does `feedback_item` describe the same underlying problem or request as `theme`?"
        }
      }
    });
  });
});

describe(decideTheme.name, () => {
  it("joins the only theme that clears the threshold", () => {
    expect(decideTheme({ theme_0: 0.01, theme_1: MIN_THEME_MATCH_PROBABILITY, theme_2: 0.02 }, CANDIDATES)).toEqual({
      themeId: "theme-b",
      possibleDuplicateThemeIds: [],
      compared: [
        { themeId: "theme-a", probability: 0.01 },
        { themeId: "theme-b", probability: MIN_THEME_MATCH_PROBABILITY },
        { themeId: "theme-c", probability: 0.02 }
      ],
      rule: "only_theme_cleared"
    });
  });

  it("joins the likeliest of several themes that clear it and flags them as a possible duplicate", () => {
    const decision = decideTheme({ theme_0: MIN_THEME_MATCH_PROBABILITY, theme_1: 0.99, theme_2: 0 }, CANDIDATES);

    expect(decision).toMatchObject({ themeId: "theme-b", possibleDuplicateThemeIds: ["theme-b", "theme-a"], rule: "best_of_several_cleared" });
  });

  it("starts a new theme when none clears the threshold", () => {
    expect(decideTheme({ theme_0: MIN_THEME_MATCH_PROBABILITY - 0.01, theme_1: 0, theme_2: 0 }, CANDIDATES)).toMatchObject({
      themeId: null,
      possibleDuplicateThemeIds: [],
      rule: "no_theme_cleared"
    });
  });
});
