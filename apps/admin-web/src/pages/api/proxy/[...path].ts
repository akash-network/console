import { getAccessToken, getSession } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";

const ADMIN_API_URL = process.env.ADMIN_API_URL || "http://localhost:3010";

const HEADERS_TO_SKIP = new Set([
  "connection",
  "proxy-connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "host",
  "cookie"
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res);

    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let accessToken: string | undefined;

    try {
      const tokenResponse = await getAccessToken(req, res);
      accessToken = tokenResponse.accessToken;
    } catch {
      return res.status(401).json({ error: "Unable to get access token" });
    }

    if (!accessToken) {
      return res.status(401).json({ error: "No access token available" });
    }

    const pathSegments = req.query.path;
    const path = Array.isArray(pathSegments) ? pathSegments.join("/") : pathSegments || "";
    const queryString = req.url?.includes("?") ? req.url.split("?")[1] : "";
    const targetUrl = `${ADMIN_API_URL}/${path}${queryString ? `?${queryString}` : ""}`;

    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    };

    Object.entries(req.headers).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      const lowKey = key.toLowerCase();
      if (HEADERS_TO_SKIP.has(lowKey)) return;
      if (lowKey === "content-type") return;

      if (Array.isArray(value)) {
        headers[key] = value.join(", ");
      } else {
        headers[key] = value;
      }
    });

    const method = req.method || "GET";
    const hasBody = method !== "GET" && method !== "HEAD" && req.body;
    const body = hasBody ? JSON.stringify(req.body) : undefined;

    const response = await fetch(targetUrl, {
      method,
      headers,
      body
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      const lowKey = key.toLowerCase();
      if (!HEADERS_TO_SKIP.has(lowKey)) {
        responseHeaders[key] = value;
      }
    });

    res.status(response.status);
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    }

    const text = await response.text();
    return res.send(text);
  } catch {
    return res.status(502).json({ error: "Proxy error" });
  }
}
