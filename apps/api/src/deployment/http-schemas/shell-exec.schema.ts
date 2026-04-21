import { z } from "zod";

export const ShellExecParamsSchema = z.object({
  dseq: z.string(),
  gseq: z.coerce.number().int().nonnegative(),
  oseq: z.coerce.number().int().nonnegative()
});

export const ShellExecRequestSchema = z.object({
  command: z.string().min(1).max(4096),
  service: z.string().min(1).max(253),
  timeout: z.number().int().min(1).max(120).default(60)
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
