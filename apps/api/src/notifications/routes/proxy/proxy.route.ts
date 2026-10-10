import { Hono } from "hono";
import assert from "http-assert";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { AppContext } from "@src/core/types/app-context";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { NotificationsConfig } from "@src/notifications/config/env.config";
import { NOTIFICATIONS_IDENTITY_HEADERS, organizationIdentityHeaders, stripIdentityHeaders } from "@src/notifications/lib/identity-headers/identity-headers";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { OrganizationContext, ProjectScope } from "@src/organization/types/organization-context";

const notificationsApiProxy = new Hono();

export interface ProxyDependencies {
  authService: AuthService;
  userWalletRepository: UserWalletRepository;
  deploymentSettingRepository: DeploymentSettingRepository;
  executionContextService: ExecutionContextService;
  config: NotificationsConfig;
  fetchFn: typeof fetch;
}

const DEPLOYMENT_ALERTS_PATH = /^\/v1\/deployment-alerts\/([^/]+)$/;

const ALERTS_PATH = "/v1/alerts";

export const createProxy =
  ({ authService, userWalletRepository, deploymentSettingRepository, executionContextService, config, fetchFn }: ProxyDependencies) =>
  async (c: AppContext) => {
    const { req } = c;
    const clientHeaders = Object.fromEntries([...req.raw.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
    const headers = stripIdentityHeaders(clientHeaders);
    const isBodyAllowed = !["GET", "HEAD"].includes(req.method);

    const subject = req.url.includes("/v1/notification-channels") ? "NotificationChannel" : "Alert";
    authService.throwUnlessCan(isBodyAllowed ? "manage" : "read", subject);

    const url = new URL(req.url);
    const targetUrl = config.NOTIFICATIONS_API_BASE_URL + url.pathname + url.search;

    const userId = authService.currentUser.id;
    headers[NOTIFICATIONS_IDENTITY_HEADERS.userId] = userId;

    const userWallet = await userWalletRepository.findOneByUserId(userId);

    assert(userWallet, 403, "User does not have a managed wallet");

    if (userWallet.address) {
      headers[NOTIFICATIONS_IDENTITY_HEADERS.ownerAddress] = userWallet.address;
    }

    const organizationContext = executionContextService.get("ORGANIZATION_CONTEXT");

    if (organizationContext) {
      Object.assign(headers, organizationIdentityHeaders(organizationContext));
    }

    const body = isBodyAllowed ? await req.text() : undefined;
    const dseq = targetedDseq(req.method, url, body);
    const projectId =
      organizationContext && dseq
        ? await projectOfReachableDeployment(deploymentSettingRepository, { dseq, userId, context: organizationContext, isWrite: isBodyAllowed })
        : null;

    if (projectId) {
      headers[NOTIFICATIONS_IDENTITY_HEADERS.projectId] = projectId;
    }

    if (isBodyAllowed && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }

    return fetchFn(targetUrl, {
      method: req.method,
      headers,
      body
    });
  };

/** The deployment a request names, through the deployment alerts path, the alerts dseq filter or a new alert's params. */
function targetedDseq(method: string, url: URL, body: string | undefined): string | undefined {
  const pathname = withoutTrailingSlashes(url.pathname);
  const fromPath = pathname.match(DEPLOYMENT_ALERTS_PATH)?.[1];

  if (fromPath) {
    return decodeURIComponent(fromPath);
  }

  if (pathname !== ALERTS_PATH) {
    return undefined;
  }

  return method === "GET" ? url.searchParams.get("dseq") ?? undefined : dseqOfAlertBody(body);
}

/** The notifications service routes a path with trailing slashes like the one without, so the checks must too. */
function withoutTrailingSlashes(pathname: string): string {
  return pathname.replace(/\/+$/, "");
}

function dseqOfAlertBody(body: string | undefined): string | undefined {
  try {
    const dseq = JSON.parse(body ?? "")?.data?.params?.dseq;
    return typeof dseq === "string" ? dseq : undefined;
  } catch {
    return undefined;
  }
}

/** Answers 404 for a deployment outside the caller's organization or project scope, and returns the project a write files into. */
async function projectOfReachableDeployment(
  deploymentSettingRepository: DeploymentSettingRepository,
  { dseq, userId, context, isWrite }: { dseq: string; userId: string; context: OrganizationContext; isWrite: boolean }
): Promise<string | null> {
  if (isWrite) {
    const deployment = await deploymentSettingRepository.findTenancy({ userId, dseq });
    const isFiledElsewhere = !!deployment?.organizationId && deployment.organizationId !== context.organizationId;

    assert(!isFiledElsewhere && isInScope(deployment?.projectId ?? null, context.projectScope), 404, "Deployment not found");

    return deployment?.projectId ?? null;
  }

  if (context.projectScope.kind === "projects") {
    const projectIds = await deploymentSettingRepository.findProjectIdsByDseq({ organizationId: context.organizationId, dseq });
    assert(
      projectIds.some(projectId => isInScope(projectId, context.projectScope)),
      404,
      "Deployment not found"
    );
  }

  return null;
}

function isInScope(projectId: string | null, scope: ProjectScope): boolean {
  return scope.kind === "all" || (projectId !== null && scope.projectIds.includes(projectId));
}

const proxyRoute = createProxy({
  authService: container.resolve(AuthService),
  userWalletRepository: container.resolve(UserWalletRepository),
  deploymentSettingRepository: container.resolve(DeploymentSettingRepository),
  executionContextService: container.resolve(ExecutionContextService),
  config: container.resolve(NOTIFICATIONS_CONFIG),
  fetchFn: fetch
});
const proxyRouteIfEnabled = (featureFlag: FeatureFlagValue) => {
  return async (c: AppContext) => {
    if (!container.resolve(FeatureFlagsService).isEnabled(featureFlag)) return c.json({ error: "MethodNotAllowed" }, 405);

    return proxyRoute(c);
  };
};

notificationsApiProxy.all("/v1/notification-channels/*", proxyRoute);
notificationsApiProxy.all("/v1/notification-channels", proxyRoute);

notificationsApiProxy.get("/v1/alerts", proxyRoute);
notificationsApiProxy.post("/v1/alerts", proxyRouteIfEnabled(FeatureFlags.NOTIFICATIONS_ALERT_CREATE));
notificationsApiProxy.get("/v1/alerts/*", proxyRoute);
notificationsApiProxy.delete("/v1/alerts/*", proxyRoute);
notificationsApiProxy.patch("/v1/alerts/*", proxyRouteIfEnabled(FeatureFlags.NOTIFICATIONS_ALERT_UPDATE));

notificationsApiProxy.all("/v1/deployment-alerts/*", proxyRoute);
notificationsApiProxy.all("/v1/deployment-alerts", proxyRoute);

export { notificationsApiProxy };
