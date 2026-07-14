import { z } from "zod";

export const ShellExecParamsSchema = z.object({
  dseq: z.string().regex(/^\d+$/),
  gseq: z.coerce.number().int().nonnegative(),
  oseq: z.coerce.number().int().nonnegative()
});

export const ShellExecRequestSchema = z.object({
  command: z.array(z.string().min(1)).min(1).max(64),
  service: z.string().min(1).max(253),
  timeout: z.number().int().min(1).max(120).default(60),
  stdin: z.string().max(1_048_576).optional().openapi({
    description:
      'Optional raw UTF-8 data streamed to the command\'s standard input (max 1 MiB). Put secrets HERE (env files, tokens, passwords) — never in `command`, whose tokens are placed in the provider-proxy request URL, which is logged. Example command: ["sh","-c","cat > /run/secrets/.env"].',
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
