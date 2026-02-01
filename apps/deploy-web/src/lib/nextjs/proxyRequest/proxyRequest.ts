import type { NextApiRequest, NextApiResponse } from "next";
import { Readable, Writable } from "node:stream";

const HEADERS_TO_SKIP = new Set([
  "connection",
  "proxy-connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization"
]);

export async function proxyRequest(req: NextApiRequest, res: NextApiResponse, options: ProxyOptions) {
  const abortController = new AbortController();
  const onClose = () => abortController.abort(new Error("client disconnected"));
  req.on("aborted", onClose);
  res.on("close", onClose);

  const signals = [abortController.signal, AbortSignal.timeout(options.timeout ?? 60_000)];
  if (options.signal) signals.push(options.signal);
  const requestSignal = AbortSignal.any(signals);

  try {
    await forwardRequestStream(req, res, { ...options, signal: requestSignal });
  } catch (error) {
    options.onError?.(error as Error);
    // If headers not sent yet, we can send a 502
    if (!res.headersSent) {
      res.statusCode = requestSignal.aborted ? 499 : 502; // 499 = client closed (nginx convention)
      res.end(JSON.stringify({ error: "Proxy error" }));
    } else {
      // Mid-stream error: can only tear down the socket
      res.destroy();
    }
  } finally {
    req.off("aborted", onClose);
    res.off("close", onClose);
  }
}

interface ProxyOptions {
  target: string;
  signal?: AbortSignal;
  /**
   * timeout in milliseconds
   * if not provided, will use 60 seconds
   */
  timeout?: number;
  headers?: HeadersInit;
  fetch?: typeof globalThis.fetch;
  onError?: (error: Error) => void;
}

async function forwardRequestStream(req: NextApiRequest, res: NextApiResponse, options: ProxyOptions) {
  const headers = new Headers();

  Object.entries(req.headers).forEach(([key, value]) => {
    const lowKey = key.toLowerCase();
    if (lowKey === "host" || lowKey === "connection" || lowKey === "cookie") return;
    if (HEADERS_TO_SKIP.has(lowKey)) return;
    if (!Array.isArray(value)) {
      headers.set(key, value as string);
      return;
    }
    value.forEach(v => headers.append(key, v));
  });
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value as string);
    });
  }

  const method = req.method?.toUpperCase() || "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : Readable.toWeb(req);

  const fetch = options.fetch ?? globalThis.fetch;
  const response = await fetch(options.target, {
    method: req.method,
    headers,
    body,
    duplex: body ? "half" : undefined,
    signal: options.signal
  } as any); // TODO: fetch API typings are mixed between envs, here we should have nodejs specific only

  res.writeHead(response.status, filterResponseHeaders(response.headers));

  if (!response.body) return res.end();

  await response.body.pipeTo(Writable.toWeb(res), { signal: options.signal });
}

function filterResponseHeaders(headers: Headers) {
  const result: Record<string, string> = {};
  for (const [k, v] of headers.entries()) {
    if (HEADERS_TO_SKIP.has(k.toLowerCase())) continue;
    result[k] = v;
  }
  return result;
}
