import { z } from "zod";

/** http is tolerated only for these local-dev hosts; every deployed inbox worker URL must be https. */
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The bearer token in E2E_INBOX_API_TOKEN is sent to whatever host this resolves to, so the URL is
 * constrained to an absolute https endpoint (or plain http on loopback for local dev) rather than any
 * non-empty string, which turns a mistyped/insecure value into a clear config error up front.
 */
export const inboxApiUrlSchema = z
  .string({ required_error: "Base URL of the e2e inbox worker that captures OTP emails (see https://github.com/akash-network/e2e-inbox-worker)" })
  .trim()
  .min(1)
  .transform(url => url.replace(/\/+$/, ""))
  .superRefine((url, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `E2E_INBOX_API_URL must be an absolute URL, got "${url}"` });
      return;
    }

    const isLoopbackHttp = parsed.protocol === "http:" && LOOPBACK_HOSTNAMES.has(parsed.hostname);
    if (parsed.protocol !== "https:" && !isLoopbackHttp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `E2E_INBOX_API_URL must use https (http allowed only for loopback hosts), got "${parsed.protocol}//${parsed.host}"`
      });
    }
  });
