import type { ConversationToClassify } from "@src/feedback/lib/feedback-classification-prompt/feedback-classification-prompt";
import type { ItemToMatch, ThemeCandidate } from "@src/feedback/lib/feedback-theme-match-prompt/feedback-theme-match-prompt";
import type { FeedbackClassificationType } from "@src/feedback/model-schemas";
import type { JevQuestion } from "@src/feedback/services/typesafe-client/typesafe.client";

const PRODUCT = "Akash Console, a web app for deploying workloads on the Akash Network";

/** Provisional until product confirms it: a mixed item is filed under the first type here that clears its threshold. */
export const TYPE_PRIORITY = ["bug", "ux_friction", "feature_request", "support_question"] as const satisfies readonly FeedbackClassificationType[];

export const MIN_TYPE_PROBABILITY = 0.5;
export const MIN_STUCK_PROBABILITY = 0.7;
export const MIN_NOT_STUCK_PROBABILITY = 0.6;
export const MIN_THEME_MATCH_PROBABILITY = 0.5;
export const TEXT_SENTIMENT_WEIGHT_WITH_RATING = 0.5;

const TYPE_QUESTIONS: Record<FeedbackClassificationType, JevQuestion> = {
  bug: {
    type: "noul",
    instructions: "Does the user report that something in `product` is broken: an error, a crash, a failure, or behavior that is plainly wrong?",
    criteria: {
      true: "The user reports a defect or failure in the product or in a deployment it manages.",
      false:
        "Nothing is reported as broken: the user asks a question or for something new, says something works but is slow or awkward, or hit a failure caused by their own setup."
    }
  },
  support_question: {
    type: "noul",
    instructions: "Does the user ask a question or ask for help?",
    criteria: {
      true: "The user asks how to do something, asks about their account, deployments or billing, or asks for help or for a task to be done.",
      false: "The user only reports something, asks for a new feature, or comments, without asking for anything."
    }
  },
  feature_request: {
    type: "noul",
    instructions: "Does the user ask for a new feature, option, integration or capability to be added to `product`?",
    criteria: {
      true: "The user asks for something to be built or added, or wishes the product did something it does not.",
      false: "The user only asks how to do something or whether something is possible, reports a problem, or comments."
    }
  },
  ux_friction: {
    type: "noul",
    instructions: "Does the user say something works but is confusing, hard to find, tedious, or slow?"
  }
};

const SENTIMENT_LEVELS = [
  "Very negative: angry, frustrated, or ready to give up",
  "Somewhat negative: disappointed or annoyed",
  "Neutral or mixed: factual, or good and bad in balance",
  "Somewhat positive: satisfied or appreciative",
  "Very positive: delighted or full of praise"
];

const SENTIMENT_MIDPOINT = (SENTIMENT_LEVELS.length - 1) / 2;

export const SENTIMENT_QUESTION_ID = "sentiment";
export const ENDED_STUCK_QUESTION_ID = "ended_stuck";
export const NOT_STUCK_QUESTION_ID = "not_stuck";

export function typeQuestionId(type: FeedbackClassificationType): string {
  return `type_${type}`;
}

export const ITEM_QUESTIONS: Record<string, JevQuestion> = {
  ...Object.fromEntries(TYPE_PRIORITY.map(type => [typeQuestionId(type), TYPE_QUESTIONS[type]])),
  [SENTIMENT_QUESTION_ID]: {
    type: "score",
    instructions: "How does the user feel about their experience with `product`, judging from what they wrote in `feedback`?",
    criteria: SENTIMENT_LEVELS
  },
  [ENDED_STUCK_QUESTION_ID]: {
    type: "noul",
    instructions: "Does `feedback` show that the user was left blocked by their problem?",
    criteria: {
      true: "The user says they gave up, are still blocked or cannot continue, or the conversation ends with their problem unsolved.",
      false: "Nothing in `feedback` shows the user was left blocked."
    }
  },
  [NOT_STUCK_QUESTION_ID]: {
    type: "noul",
    instructions: "Does `feedback` show that the user is not blocked?",
    criteria: {
      true: "The user got past the problem, found a workaround, got what they asked for, or raises nothing that blocks them, such as a request, a suggestion or praise.",
      false: "The user describes a problem without saying whether they got past it."
    }
  }
};

/** The star rating stays out, so the sentiment Score reads the text alone and code weighs the rating in. */
export function itemStateOf(feedbackItem: Record<string, unknown>): Record<string, unknown> {
  return { product: PRODUCT, feedback: Object.fromEntries(Object.entries(feedbackItem).filter(([key]) => key !== "rating")) };
}

export function decideType(values: Record<string, number>) {
  const cleared = TYPE_PRIORITY.filter(type => values[typeQuestionId(type)] >= MIN_TYPE_PROBABILITY);
  const rule = cleared.length === 0 ? "no_type_cleared" : cleared.length === 1 ? "only_type_cleared" : "priority_order";

  return { type: cleared[0] ?? null, cleared, rule };
}

export function decideSentiment(sentimentLevel: number, rating: number | null) {
  const textSentiment = (sentimentLevel - SENTIMENT_MIDPOINT) / SENTIMENT_MIDPOINT;
  if (rating === null) return { sentimentScore: textSentiment, rule: "text_only" };

  const ratingSentiment = (rating - 3) / 2;

  return {
    sentimentScore: TEXT_SENTIMENT_WEIGHT_WITH_RATING * textSentiment + (1 - TEXT_SENTIMENT_WEIGHT_WITH_RATING) * ratingSentiment,
    rule: "text_and_rating"
  };
}

/** What the stored conversation already settles, so Jev only judges how the rest ended. */
export function stuckFactOf(conversation: Pick<ConversationToClassify, "resolvedByUser" | "messages">) {
  if (conversation.resolvedByUser !== null) return { endedStuck: !conversation.resolvedByUser, rule: "resolved_by_user" };

  const lastUserIndex = conversation.messages.findLastIndex(({ role }) => role === "user");
  const isFinalTurnUnanswered = lastUserIndex !== -1 && !conversation.messages.slice(lastUserIndex).some(({ role }) => role === "assistant");

  return isFinalTurnUnanswered ? { endedStuck: true, rule: "final_turn_unanswered" } : null;
}

/** Two independent judgments, so an item with no sign either way stays unknown instead of reading as stuck. */
export function decideStuck(stuckProbability: number, notStuckProbability: number) {
  const isStuck = stuckProbability >= MIN_STUCK_PROBABILITY;
  const isNotStuck = notStuckProbability >= MIN_NOT_STUCK_PROBABILITY;
  if (isStuck && isNotStuck) return { endedStuck: null, rule: "judgments_conflict" };
  if (isStuck) return { endedStuck: true, rule: "judged_stuck" };
  if (isNotStuck) return { endedStuck: false, rule: "judged_not_stuck" };

  return { endedStuck: null, rule: "judgment_unsure" };
}

function themeQuestionId(index: number): string {
  return `theme_${index}`;
}

export function themeStateOf(item: ItemToMatch): Record<string, unknown> {
  return { product: PRODUCT, feedback_item: { type: item.type, summary: item.summary } };
}

export function themeQuestionsFor(candidates: ThemeCandidate[]): Record<string, JevQuestion> {
  return Object.fromEntries(
    candidates.map((candidate, index) => [
      themeQuestionId(index),
      {
        type: "noul",
        instructions: {
          theme: { title: candidate.title, summary: candidate.summary ?? undefined },
          question: "Does `feedback_item` describe the same underlying problem or request as `theme`?"
        }
      }
    ])
  );
}

/** Joins the likeliest theme that clears the threshold; when several clear it, they likely describe one problem and are flagged as a possible duplicate. */
export function decideTheme(values: Record<string, number>, candidates: ThemeCandidate[]) {
  const compared = candidates.map((candidate, index) => ({ themeId: candidate.id, probability: values[themeQuestionId(index)] }));
  const cleared = compared.filter(({ probability }) => probability >= MIN_THEME_MATCH_PROBABILITY).sort((a, b) => b.probability - a.probability);
  const rule = cleared.length === 0 ? "no_theme_cleared" : cleared.length === 1 ? "only_theme_cleared" : "best_of_several_cleared";

  return {
    themeId: cleared[0]?.themeId ?? null,
    possibleDuplicateThemeIds: cleared.length > 1 ? cleared.map(({ themeId }) => themeId) : [],
    compared,
    rule
  };
}
