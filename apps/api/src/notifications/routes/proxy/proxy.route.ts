import { Hono } from "hono";
import assert from "http-assert";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { AppContext } from "@src/core/types/app-context";
import type { NotificationsConfig } from "@src/notifications/config";
import { config } from "@src/notifications/config";

const notificationsApiProxy = new Hono();

export const createProxy =
  (authService: AuthService, userWalletRepository: UserWalletRepository, config: NotificationsConfig, fetchFn: typeof fetch) => async (c: AppContext) => {
    const { req } = c;
    const headers = Object.fromEntries([...req.raw.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));

    assert(!headers["x-user-id"], 403, "x-user-id header is not allowed");
    assert(!headers["x-owner-address"], 403, "x-owner-address header is not allowed");

    const subject = req.url.includes("/v1/notification-channels") ? "NotificationChannel" : "Alert";
    authService.throwUnlessCan("manage", subject);

    const url = new URL(req.url);
    const targetUrl = config.NOTIFICATIONS_API_BASE_URL + url.pathname + url.search;

    const isBodyAllowed = !["GET", "HEAD"].includes(req.method);

    const userId = authService.currentUser.id;
    headers["x-user-id"] = userId;

    const userWallet = await userWalletRepository.findOneByUserId(userId);

    assert(userWallet, 403, "User does not have a managed wallet");

    if (userWallet.address) {
      headers["x-owner-address"] = userWallet.address;
    }

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

const proxyRoute = createProxy(container.resolve(AuthService), container.resolve(UserWalletRepository), config, fetch);
const proxyRouteIfEnabled = (featureFlag: FeatureFlagValue) => {
  return async (c: AppContext) => {
    if (!container.resolve(FeatureFlagsService).isEnabled(featureFlag)) return c.json({ error: "MethodNotAllowed" }, 405);

    return proxyRoute(c);
  };
};

notificationsApiProxy.all("/v1/notification-channels/*", proxyRoute);
notificationsApiProxy.all("/v1/notification-channels", proxyRoute);

notificationsApiProxy.get("/v1/alerts", proxyRoute);
notificationsApiProxy.post("/v1/alerts", proxyRouteIfEnabled(FeatureFlags.NOTIFICATIONS_ALERT_MUTATION));
notificationsApiProxy.get("/v1/alerts/*", proxyRoute);
notificationsApiProxy.delete("/v1/alerts/*", proxyRoute);
notificationsApiProxy.patch("/v1/alerts/*", proxyRouteIfEnabled(FeatureFlags.NOTIFICATIONS_ALERT_MUTATION));

notificationsApiProxy.all("/v1/deployment-alerts/*", proxyRoute);
notificationsApiProxy.all("/v1/deployment-alerts", proxyRoute);

export { notificationsApiProxy };
