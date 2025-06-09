import { LoggerService } from "@akashnetwork/logging";
import { getConnInfo } from "@hono/node-server/conninfo";
import crypto from "crypto";
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

export type ClientInfoContextVariables = {
  clientInfo?: {
    ip: string;
    userAgent: string | undefined;
    fingerprint: string | undefined;
  };
};

let logger: LoggerService | undefined;
export const clientInfoMiddleware = createMiddleware<{
  Variables: ClientInfoContextVariables;
}>(async (c: Context, next: Next) => {
  if (!c.env) {
    return next();
  }

  try {
    const info = getConnInfo(c);
    const ip = c.req.header("cf-connecting-ip") || info.remote.address;
    const userAgent = c.req.header("User-Agent");
    const accept = c.req.header("Accept");
    const acceptEncoding = c.req.header("Accept-Encoding");
    const acceptLanguage = c.req.header("Accept-Language");

    const fingerprintSource = [ip, userAgent, accept, acceptEncoding, acceptLanguage].join("");
    const fingerprint = crypto.createHash("sha256").update(fingerprintSource).digest("hex");

    c.set("clientInfo", {
      ip: ip,
      userAgent: userAgent,
      fingerprint: fingerprint
    });
  } catch (error) {
    logger ??= LoggerService.forContext("clientInfoMiddleware");
    logger.error({ error });
  } finally {
    await next();
  }
});
