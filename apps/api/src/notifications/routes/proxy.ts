import { Hono } from "hono";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { config } from "@src/notifications/config";

const notificationsApiProxy = new Hono();

const proxy = async (c: any) => {
  const { req } = c;

  const authService = container.resolve(AuthService);
  const subject = req.url.includes("/v1/contact-points") ? "ContactPoint" : "Alert";
  authService.throwUnlessCan("manage", subject);

  const url = new URL(req.url);
  const targetUrl = config.NOTIFICATIONS_API_BASE_URL + url.pathname + url.search;

  const isBodyAllowed = !["GET", "HEAD"].includes(req.method);

  const headers = Object.fromEntries(req.raw.headers.entries());
  headers["x-user-id"] = authService.currentUser.userId;

  if (isBodyAllowed && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const body = isBodyAllowed ? await req.text() : undefined;

  return fetch(targetUrl, {
    method: req.method,
    headers,
    body
  });
};

notificationsApiProxy.all("/v1/contact-points/*", proxy);
notificationsApiProxy.all("/v1/contact-points", proxy);
notificationsApiProxy.all("/v1/alerts/*", proxy);
notificationsApiProxy.all("/v1/alerts", proxy);

export { notificationsApiProxy };
