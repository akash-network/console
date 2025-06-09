import { Hono } from "hono";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { NotificationsConfig } from "@src/notifications/config";
import { config } from "@src/notifications/config";

const notificationsApiProxy = new Hono();

export const createProxy = (authService: AuthService, config: NotificationsConfig, fetchFn: typeof fetch) => async (c: any) => {
  const { req } = c;

  const subject = req.url.includes("/v1/notification-channels") ? "NotificationChannel" : "Alert";
  authService.throwUnlessCan("manage", subject);

  const url = new URL(req.url);
  const targetUrl = config.NOTIFICATIONS_API_BASE_URL + url.pathname + url.search;

  const isBodyAllowed = !["GET", "HEAD"].includes(req.method);

  const headers = Object.fromEntries(req.raw.headers.entries());
  headers["x-user-id"] = authService.currentUser.id;

  if (isBodyAllowed && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const body = isBodyAllowed ? await req.text() : undefined;

  return fetchFn(targetUrl, {
    method: req.method,
    headers,
    body
  });
};

const proxyRoute = createProxy(container.resolve(AuthService), config, fetch);

notificationsApiProxy.all("/v1/notification-channels/*", proxyRoute);
notificationsApiProxy.all("/v1/notification-channels", proxyRoute);
notificationsApiProxy.all("/v1/alerts/*", proxyRoute);
notificationsApiProxy.all("/v1/alerts", proxyRoute);
notificationsApiProxy.all("/v1/deployment-alerts/*", proxyRoute);
notificationsApiProxy.all("/v1/deployment-alerts", proxyRoute);

export { notificationsApiProxy };
