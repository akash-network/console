import { z } from "@hono/zod-openapi";

/**
 * Request-side size limits for the shell-exec endpoint, exported as named
 * constants so the schema, the route body limit, and the tests all derive from
 * a single source of truth and cannot drift (per maintainer review on #3097).
 *
 * Real secret-injection payloads (env files, API keys, DB passwords, TLS
 * cert/key chains, service-mesh tokens) are kilobytes — these caps are generous
 * for the intended use while keeping per-request memory bounded so concurrent
 * execs cannot be used as a cheap DoS.
 */
export const MAX_STDIN_BYTES = 16 * 1024;
export const MAX_COMMAND_ARGS = 64;
export const MAX_COMMAND_ARG_BYTES = 1024;
export const SERVICE_NAME_MAX = 253;

/**
 * Headroom for JSON key names, quotes, and escaping. The route body limit is
 * measured on RAW request bytes (before JSON parsing), whereas the per-field
 * byte caps above apply to the decoded strings (after parsing) — related but
 * not identical. This overhead ensures a schema-valid request is never rejected
 * by the body limit first.
 */
export const JSON_ENVELOPE_OVERHEAD_BYTES = 2 * 1024;

/**
 * Explicit request-body limit for the route, DERIVED arithmetically from the
 * field caps above (never hardcoded) so it stays in sync automatically if any
 * individual limit changes.
 */
export const SHELL_EXEC_BODY_LIMIT_BYTES = MAX_COMMAND_ARGS * MAX_COMMAND_ARG_BYTES + MAX_STDIN_BYTES + SERVICE_NAME_MAX + JSON_ENVELOPE_OVERHEAD_BYTES;

/** UTF-8 byte length — the true wire size, unlike `.length`/`z.string().max()` which count UTF-16 code units. */
const utf8Bytes = (value: string): number => Buffer.byteLength(value, "utf8");

export const ShellExecParamsSchema = z.object({
  dseq: z.string().regex(/^\d+$/),
  gseq: z.coerce.number().int().nonnegative(),
  oseq: z.coerce.number().int().nonnegative()
});

export const ShellExecRequestSchema = z.object({
  command: z
    .array(
      z
        .string()
        .min(1)
        .refine(s => utf8Bytes(s) <= MAX_COMMAND_ARG_BYTES, { message: `each command argument must not exceed ${MAX_COMMAND_ARG_BYTES} bytes (UTF-8)` })
    )
    .min(1)
    .max(MAX_COMMAND_ARGS),
  service: z.string().min(1).max(SERVICE_NAME_MAX),
  timeout: z.number().int().min(1).max(120).default(60),
  stdin: z
    .string()
    .refine(s => utf8Bytes(s) <= MAX_STDIN_BYTES, { message: `stdin must not exceed ${MAX_STDIN_BYTES} bytes (UTF-8)` })
    .optional()
    .openapi({
      description:
        'Optional raw UTF-8 data streamed to the command\'s standard input (max 16 KiB). Put secrets HERE (env files, tokens, passwords) — never in `command`, whose tokens are placed in the provider-proxy request URL, which is logged. Example command: ["sh","-c","cat > /run/secrets/.env"].',
      example: "SECRET=value"
    })
});

export const ShellExecResponseSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  truncated: z.boolean()
});

export type ShellExecParams = z.infer<typeof ShellExecParamsSchema>;
export type ShellExecRequest = z.infer<typeof ShellExecRequestSchema>;
export type ShellExecResponse = z.infer<typeof ShellExecResponseSchema>;
