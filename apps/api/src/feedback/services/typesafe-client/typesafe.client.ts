import type { HttpClient } from "@akashnetwork/http-sdk";
import { isAxiosError } from "axios";
import { handleWhen, IterableBackoff, retry, type RetryPolicy } from "cockatiel";
import { inject, singleton } from "tsyringe";
import { z } from "zod";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";
import { TYPESAFE_HTTP_CLIENT } from "@src/feedback/providers/typesafe-http-client.provider";

export const TYPESAFE_RETRY_DELAYS_MS = [500, 2000];

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export type JevText = string | Record<string, unknown>;

export type JevQuestion =
  | { type: "noul"; instructions: JevText; criteria?: { true: JevText; false: JevText } }
  | { type: "score"; instructions: JevText; criteria: JevText[] };

export interface JevRequest {
  model: string;
  state: Record<string, unknown>;
  questions: Record<string, JevQuestion>;
}

export interface JevJudgments {
  model: string;
  /** The probability of yes for a Noul, and the expected level for a Score, keyed by question id. */
  values: Record<string, number>;
  inputTokens: number;
}

export class TypeSafeUnavailableError extends Error {
  name = "TypeSafeUnavailableError";

  constructor() {
    super("TypeSafe is not configured");
  }
}

export class TypeSafeRequestError extends Error {
  name = "TypeSafeRequestError";

  constructor(
    message: string,
    readonly status: number | undefined
  ) {
    super(message);
  }

  get isRetryable(): boolean {
    return this.status === undefined || RETRYABLE_STATUSES.has(this.status);
  }
}

export class TypeSafeOutputError extends Error {
  name = "TypeSafeOutputError";
}

const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
  z.object({ type: z.literal("score"), score: z.number() })
]);

const systemOneResponseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), answerSchema),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() })
});

/** Error messages carry the status only, since a validation error can quote the feedback text and the request config holds the API key. */
function toRequestError(error: unknown): TypeSafeRequestError {
  if (!isAxiosError(error)) return new TypeSafeRequestError(`TypeSafe request failed: ${String(error)}`, undefined);
  if (!error.response) return new TypeSafeRequestError(`TypeSafe request failed: ${error.code}`, undefined);

  return new TypeSafeRequestError(`TypeSafe answered ${error.response.status}`, error.response.status);
}

function valuesOf(answers: z.infer<typeof systemOneResponseSchema>["answers"], questions: JevRequest["questions"]): Record<string, number> {
  const unanswered = Object.entries(questions)
    .filter(([id, question]) => answers[id]?.type !== question.type)
    .map(([id]) => id);
  if (unanswered.length > 0) throw new TypeSafeOutputError(`TypeSafe left questions unanswered: ${unanswered.join(", ")}`);

  const outOfRange = Object.entries(questions)
    .filter(([id, question]) => !isWithinLevels(answers[id], question))
    .map(([id]) => id);
  if (outOfRange.length > 0) throw new TypeSafeOutputError(`TypeSafe answered outside the levels of: ${outOfRange.join(", ")}`);

  return Object.fromEntries(Object.keys(questions).map(id => [id, valueOf(answers[id])]));
}

function isWithinLevels(answer: z.infer<typeof answerSchema>, question: JevQuestion): boolean {
  if (answer.type !== "score" || question.type !== "score") return true;

  return answer.score >= 0 && answer.score <= question.criteria.length - 1;
}

function valueOf(answer: z.infer<typeof answerSchema>): number {
  return answer.type === "noul" ? answer.noul : answer.score;
}

/** TypeSafe's System One API, where Jev answers typed questions about one state; callers check `isAvailable` and fall back when no API key is configured. */
@singleton()
export class TypeSafeClient {
  readonly #logger: ReturnType<CreateLogger>;
  readonly #retryPolicy: RetryPolicy;

  constructor(
    @inject(TYPESAFE_HTTP_CLIENT) private readonly httpClient: HttpClient,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: TypeSafeClient.name });
    this.#retryPolicy = retry(
      handleWhen(error => error instanceof TypeSafeRequestError && error.isRetryable),
      { maxAttempts: TYPESAFE_RETRY_DELAYS_MS.length, backoff: new IterableBackoff(TYPESAFE_RETRY_DELAYS_MS) }
    );
  }

  isAvailable(): boolean {
    return !!this.config.TYPESAFE_API_KEY;
  }

  async judge(request: JevRequest): Promise<JevJudgments> {
    if (!this.isAvailable()) throw new TypeSafeUnavailableError();

    const data = await this.#retryPolicy.execute(() => this.#post(request));
    const parsed = systemOneResponseSchema.safeParse(data);
    if (!parsed.success) throw new TypeSafeOutputError("TypeSafe answered with an unexpected response shape");

    const { model, answers, usage } = parsed.data;
    this.#logger.info({ event: "TYPESAFE_JUDGMENTS", model, questions: Object.keys(request.questions).length, usage });

    return { model, values: valuesOf(answers, request.questions), inputTokens: usage.input_tokens };
  }

  async #post(request: JevRequest): Promise<unknown> {
    try {
      const response = await this.httpClient.post("/v1/systemone", request);

      return response.data;
    } catch (error) {
      throw toRequestError(error);
    }
  }
}
