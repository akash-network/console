import { SupportedChainNetworks } from "@akashnetwork/net";
import { createRoute, z } from "@hono/zod-openapi";
import { bech32 } from "bech32";
import { Context, TypedResponse } from "hono";
import { ClientErrorStatusCode } from "hono/utils/http-status";
import { Readable } from "stream";

import { container } from "../container";
import { httpRetry } from "../utils/retry";

const RequestPayload = z.object({
  certPem: z.string().optional(),
  keyPem: z.string().optional(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  url: z.string().url(),
  body: z.string().optional(),
  network: z.enum(container.netConfig.getSupportedNetworks() as [SupportedChainNetworks]).describe("Blockchain network"),
  providerAddress: z
    .string()
    .refine(v => !!bech32.decodeUnsafe(v), "is not bech32 address")
    .describe("Bech32 representation of provider wallet address"),
  timeout: z.number().optional()
});

export const proxyRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RequestPayload
        }
      }
    }
  },
  responses: {
    400: {
      content: {
        "text/plain": {
          schema: z.string()
        }
      },
      description: "Returned if it's not possible to establish secure connection with proxied host"
    },
    495: {
      // https://http.dev/495
      content: {
        "text/plain": {
          schema: z.string()
        }
      },
      description: "Returned if host SSL certificate is invalid"
    }
  }
});

const DEFAULT_TIMEOUT = 5_000;
export async function proxyProviderRequest(ctx: Context): Promise<Response | TypedResponse<string>> {
  const { certPem, keyPem, method, body, url, network, providerAddress, timeout } = await ctx.req.json<z.infer<typeof RequestPayload>>();

  const proxyResult = await httpRetry(
    () =>
      container.providerProxy.connect(url, {
        method,
        body,
        cert: certPem,
        key: keyPem,
        network,
        providerAddress,
        timeout: Number(timeout || DEFAULT_TIMEOUT) || DEFAULT_TIMEOUT
      }),
    {
      retryIf: result => result.ok && (!result.response.statusCode || result.response.statusCode > 500)
    }
  );

  if (proxyResult.ok === false && proxyResult.code === "insecureConnection") {
    return ctx.text("Could not establish tls connection since server responded with non-tls response", 400);
  }

  if (proxyResult.ok === false && proxyResult.code === "invalidCertificate") {
    return ctx.text(`Invalid certificate error: ${proxyResult.reason}`, 495 as ClientErrorStatusCode);
  }

  const headers = new Headers();
  Object.keys(proxyResult.response.headers).forEach(header => {
    const value = proxyResult.response.headers[header];
    if (Array.isArray(value)) {
      value.forEach(v => headers.set(header, v));
    } else {
      headers.set(header, value);
    }
  });

  return new Response(Readable.toWeb(proxyResult.response), {
    status: proxyResult.response.statusCode,
    statusText: proxyResult.response.statusMessage,
    headers
  });
}
