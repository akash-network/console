import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { AppContext } from "@src/core/types/app-context";
import type { DeploymentSettingRepository, DeploymentTenancy } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { NotificationsConfig } from "@src/notifications/config/env.config";
import { createProxy } from "@src/notifications/routes/proxy/proxy.route";
import type { OrganizationContext } from "@src/organization/types/organization-context";

import { createAkashAddress } from "@test/seeders";

describe("createProxy", () => {
  it("builds correct proxy handler for POST request", async () => {
    const { handler, context, fetchMock, authService, userId, owner, fullUrl, body } = setupProxyTest();

    const result = await handler(context);

    expect(authService.throwUnlessCan).toHaveBeenCalledWith("manage", "Alert");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example" + new URL(fullUrl).pathname + new URL(fullUrl).search,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          "x-user-id": userId,
          "x-owner-address": owner,
          "content-type": "application/json"
        })
      })
    );

    expect(result.status).toBe(200);
  });

  it("checks read access to NotificationChannel inferred from the URL and omits body for GET", async () => {
    const { handler, context, fetchMock, authService, userId, fullUrl } = setupProxyTest({ method: "GET" });

    context.req.text = async () => {
      throw new Error("should not be called for GET");
    };

    const result = await handler(context);

    expect(authService.throwUnlessCan).toHaveBeenCalledWith("read", "NotificationChannel");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example" + new URL(fullUrl).pathname + new URL(fullUrl).search,
      expect.objectContaining({
        method: "GET",
        body: undefined,
        headers: expect.objectContaining({
          "x-user-id": userId
        })
      })
    );

    expect(result.status).toBe(204);
  });

  it("forwards the identity it minted for the caller in place of every identity header the client sent", async () => {
    const { handler, context, fetchMock, userId, owner } = setupProxyTest({
      method: "GET",
      clientHeaders: {
        "x-user-id": faker.string.uuid(),
        "x-owner-address": createAkashAddress(),
        "x-organization-id": faker.string.uuid(),
        "x-organization-role": "owner",
        "x-project-scope": "all",
        "x-project-id": faker.string.uuid()
      }
    });

    await handler(context);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "x-custom": expect.any(String), "x-user-id": userId, "x-owner-address": owner }
      })
    );
  });

  it("mints only the organization to stamp while legacy rules apply", async () => {
    const organizationContext = createOrganizationContext({ mode: "legacy" });
    const { handler, context, fetchMock } = setupProxyTest({ method: "GET", organizationContext });

    await handler(context);

    const headers = forwardedHeaders(fetchMock);
    expect(headers["x-organization-id"]).toBe(organizationContext.organizationId);
    expect(headers).not.toHaveProperty("x-organization-role");
    expect(headers).not.toHaveProperty("x-project-scope");
  });

  it("mints the organization, role and project scope while organization rules apply", async () => {
    const organizationContext = createOrganizationContext({
      mode: "organization",
      role: "member",
      projectScope: { kind: "projects", projectIds: [faker.string.uuid()] }
    });
    const { handler, context, fetchMock } = setupProxyTest({ method: "GET", organizationContext });

    await handler(context);

    expect(forwardedHeaders(fetchMock)).toMatchObject({
      "x-organization-id": organizationContext.organizationId,
      "x-organization-role": "member",
      "x-project-scope": JSON.stringify(organizationContext.projectScope)
    });
  });

  it("mints the project of a deployment filed in the active organization when writing its alerts", async () => {
    const organizationContext = createOrganizationContext({ mode: "organization" });
    const projectId = faker.string.uuid();
    const { handler, context, fetchMock, deploymentSettingRepository, userId } = setupProxyTest({
      path: "/v1/deployment-alerts/1234",
      organizationContext,
      tenancy: { organizationId: organizationContext.organizationId, organizationType: "team", projectId }
    });

    await handler(context);

    expect(deploymentSettingRepository.findTenancy).toHaveBeenCalledWith({ userId, dseq: "1234" });
    expect(forwardedHeaders(fetchMock)["x-project-id"]).toBe(projectId);
  });

  it("answers 404 without forwarding a write to the alerts of a deployment filed in another organization", async () => {
    const { handler, context, fetchMock } = setupProxyTest({
      path: "/v1/deployment-alerts/1234",
      organizationContext: createOrganizationContext({ mode: "organization" }),
      tenancy: { organizationId: faker.string.uuid(), organizationType: "team", projectId: faker.string.uuid() }
    });

    await expect(handler(context)).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mints no project for a deployment not filed in any organization yet", async () => {
    const { handler, context, fetchMock } = setupProxyTest({
      path: "/v1/deployment-alerts/1234",
      organizationContext: createOrganizationContext({ mode: "organization" }),
      tenancy: { organizationId: null, organizationType: null, projectId: null }
    });

    await handler(context);

    expect(forwardedHeaders(fetchMock)).not.toHaveProperty("x-project-id");
  });

  it("mints no project for a deployment the console holds no row for", async () => {
    const { handler, context, fetchMock } = setupProxyTest({
      path: "/v1/deployment-alerts/1234",
      organizationContext: createOrganizationContext({ mode: "organization" })
    });

    await handler(context);

    expect(forwardedHeaders(fetchMock)).not.toHaveProperty("x-project-id");
  });

  it("looks up no project when reading deployment alerts or writing other alerts", async () => {
    const organizationContext = createOrganizationContext({ mode: "organization" });
    const tenancy: DeploymentTenancy = { organizationId: organizationContext.organizationId, organizationType: "team", projectId: faker.string.uuid() };
    const read = setupProxyTest({ method: "GET", path: "/v1/deployment-alerts/1234", organizationContext, tenancy });
    const write = setupProxyTest({ path: "/v1/alerts", organizationContext, tenancy });

    await read.handler(read.context);
    await write.handler(write.context);

    expect(read.deploymentSettingRepository.findTenancy).not.toHaveBeenCalled();
    expect(write.deploymentSettingRepository.findTenancy).not.toHaveBeenCalled();
    expect(forwardedHeaders(write.fetchMock)).not.toHaveProperty("x-project-id");
  });

  it("looks up no project without an organization context", async () => {
    const { handler, context, deploymentSettingRepository } = setupProxyTest({ path: "/v1/deployment-alerts/1234" });

    await handler(context);

    expect(deploymentSettingRepository.findTenancy).not.toHaveBeenCalled();
  });

  function forwardedHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
    return fetchMock.mock.calls[0][1].headers;
  }

  function createOrganizationContext(overrides: Partial<OrganizationContext>): OrganizationContext {
    return {
      organizationId: faker.string.uuid(),
      organizationType: "team",
      role: "owner",
      projectScope: { kind: "all" },
      mode: "organization",
      ...overrides
    };
  }

  type SetupOptions = {
    method?: string;
    path?: string;
    clientHeaders?: Record<string, string>;
    organizationContext?: OrganizationContext;
    tenancy?: DeploymentTenancy;
  };

  function setupProxyTest(options: SetupOptions = {}) {
    const method = options.method ?? "POST";
    const path = options.path ?? (method === "GET" ? "/v1/notification-channels" : "/v1/alerts");
    const fullUrl = `http://localhost${path}?q=${faker.string.alpha(5)}`;
    const body = { data: faker.lorem.word() };
    const userId = faker.string.uuid();

    const authService = mock<AuthService>({
      currentUser: { id: userId },
      throwUnlessCan: vi.fn().mockReturnValue(undefined)
    });
    const owner = createAkashAddress();

    const userWalletRepository = mock<UserWalletRepository>({
      async findOneByUserId() {
        return {
          address: owner
        } as any;
      }
    });

    const config: NotificationsConfig = {
      NOTIFICATIONS_API_BASE_URL: "https://proxy.example"
    };

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: method === "GET" ? 204 : 200 }));

    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(options.organizationContext);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findTenancy.mockResolvedValue(options.tenancy);

    const handler = createProxy({ authService, userWalletRepository, deploymentSettingRepository, executionContextService, config, fetchFn: fetchMock });

    const context = {
      req: {
        method,
        url: fullUrl,
        raw: {
          headers: new Headers({ "x-custom": faker.internet.domainWord(), ...options.clientHeaders })
        },
        text: async () => JSON.stringify(body)
      },
      get: vi.fn().mockReturnValue(undefined)
    } as unknown as AppContext;

    return {
      handler,
      context,
      fetchMock,
      authService,
      deploymentSettingRepository,
      userId,
      owner,
      fullUrl,
      body
    };
  }
});
