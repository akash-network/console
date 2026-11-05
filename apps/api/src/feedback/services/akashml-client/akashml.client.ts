import type { HttpClient } from "@akashnetwork/http-sdk";
import { isAxiosError } from "axios";
import { handleWhen, IterableBackoff, retry, type RetryPolicy } from "cockatiel";
import { inject, singleton } from "tsyringe";
import { z } from "zod";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { AKASHML_HTTP_CLIENT } from "@src/feedback/providers/akashml-http-client.provider";
import { FEEDBACK_CONFIG, type FeedbackConfig } from "@src/feedback/providers/config.provider";

export const AKASHML_RETRY_DELAYS_MS = [500, 2000];

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const MAX_ERROR_MESSAGE_LENGTH = 200;

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatTool {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  response_format?: { type: "json_object" } | { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
  temperature?: number;
  max_completion_tokens?: number;
}

export interface ChatCompletion {
  content: string | null;
  toolCalls: ChatToolCall[];
  finishReason: string | null;
  usage: { promptTokens: number; completionTokens: number } | null;
}

export interface JsonOutputSchema<T> {
  name: string;
  jsonSchema: Record<string, unknown>;
  parser: z.ZodType<T, z.ZodTypeDef, unknown>;
}

export type JsonCompletionRequest<T> = Omit<ChatCompletionRequest, "response_format" | "tools" | "tool_choice"> & { schema: JsonOutputSchema<T> };

export interface ChatCompletionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class AkashMlUnavailableError extends Error {
  name = "AkashMlUnavailableError";

  constructor() {
    super("AkashML is not configured");
  }
}

export class AkashMlRequestError extends Error {
  name = "AkashMlRequestError";

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

export class AkashMlOutputError extends Error {
  name = "AkashMlOutputError";
}

const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({ name: z.string(), arguments: z.string() })
});

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z.array(toolCallSchema).nullish()
        }),
        finish_reason: z.string().nullish()
      })
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).nullish()
});

/** Error messages carry the provider's answer only, because the request config holds the API key and must stay out of logs and job records. */
function toRequestError(error: unknown): AkashMlRequestError {
  if (!isAxiosError(error)) return new AkashMlRequestError(`AkashML request failed: ${String(error)}`, undefined);
  if (!error.response) return new AkashMlRequestError(`AkashML request failed: ${error.code}`, undefined);

  const { status, data } = error.response;
  const apiMessage = typeof data?.error?.message === "string" ? data.error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH) : "";

  return new AkashMlRequestError(`AkashML answered ${status}${apiMessage && `: ${apiMessage}`}`, status);
}

/** Tolerates text around the object, since some models wrap structured output in prose or reasoning. */
export function parseJsonOutput<T>(content: string | null, parser: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  const start = content?.indexOf("{") ?? -1;
  const end = content?.lastIndexOf("}") ?? -1;
  if (!content || start === -1 || end < start) throw new AkashMlOutputError("AkashML answered without a JSON object");

  let json: unknown;
  try {
    json = JSON.parse(content.slice(start, end + 1));
  } catch {
    throw new AkashMlOutputError("AkashML answered with malformed JSON");
  }

  const result = parser.safeParse(json);
  if (!result.success) {
    throw new AkashMlOutputError(`AkashML answered outside the schema: ${result.error.issues.map(issue => issue.path.join(".") || "(root)").join(", ")}`);
  }

  return result.data;
}

/** OpenAI compatible chat completions on AkashML; callers check `isAvailable` and degrade when no API key is configured. */
@singleton()
export class AkashMlClient {
  readonly #logger: ReturnType<CreateLogger>;
  readonly #retryPolicy: RetryPolicy;

  constructor(
    @inject(AKASHML_HTTP_CLIENT) private readonly httpClient: HttpClient,
    @inject(FEEDBACK_CONFIG) private readonly config: FeedbackConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AkashMlClient.name });
    this.#retryPolicy = retry(
      handleWhen(error => error instanceof AkashMlRequestError && error.isRetryable),
      { maxAttempts: AKASHML_RETRY_DELAYS_MS.length, backoff: new IterableBackoff(AKASHML_RETRY_DELAYS_MS) }
    );
  }

  isAvailable(): boolean {
    return !!this.config.AKASHML_API_KEY;
  }

  async createChatCompletion(request: ChatCompletionRequest, options: ChatCompletionOptions = {}): Promise<ChatCompletion> {
    if (!this.isAvailable()) throw new AkashMlUnavailableError();

    const data = await this.#retryPolicy.execute(() => this.#post(request, options), options.signal);
    const parsed = chatCompletionResponseSchema.safeParse(data);
    if (!parsed.success) throw new AkashMlOutputError("AkashML answered with an unexpected completion shape");

    const [choice] = parsed.data.choices;
    const usage = parsed.data.usage ? { promptTokens: parsed.data.usage.prompt_tokens, completionTokens: parsed.data.usage.completion_tokens } : null;
    this.#logger.info({ event: "AKASHML_COMPLETION", model: request.model, finishReason: choice.finish_reason ?? null, usage });

    return {
      content: choice.message.content ?? null,
      toolCalls: choice.message.tool_calls ?? [],
      finishReason: choice.finish_reason ?? null,
      usage
    };
  }

  async completeJson<T>({ schema, ...request }: JsonCompletionRequest<T>, options?: ChatCompletionOptions): Promise<T> {
    const { content } = await this.createChatCompletion(
      { ...request, response_format: { type: "json_schema", json_schema: { name: schema.name, strict: true, schema: schema.jsonSchema } } },
      options
    );

    return parseJsonOutput(content, schema.parser);
  }

  async #post(request: ChatCompletionRequest, { timeoutMs, signal }: ChatCompletionOptions): Promise<unknown> {
    try {
      const response = await this.httpClient.post("/chat/completions", request, { timeout: timeoutMs, signal });

      return response.data;
    } catch (error) {
      throw toRequestError(error);
    }
  }
}
