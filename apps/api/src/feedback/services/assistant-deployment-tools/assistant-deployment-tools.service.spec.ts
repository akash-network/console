import { yaml } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityController } from "@src/activity/controllers/activity/activity.controller";
import type { ActivityResponse } from "@src/activity/http-schemas/activity.schema";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import type { DeploymentSettingController } from "@src/deployment/controllers/deployment-setting/deployment-setting.controller";
import type { GetDeploymentResponse, ListDeploymentsItem } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentSetting } from "@src/deployment/http-schemas/deployment-setting.schema";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { AssistantUsdService } from "@src/feedback/services/assistant-usd/assistant-usd.service";
import { AssistantDeploymentToolsService } from "./assistant-deployment-tools.service";

import { createDeploymentLease, createGetDeploymentResponseData } from "@test/seeders/get-deployment-response.seeder";

describe(AssistantDeploymentToolsService.name, () => {
  describe("listDeployments", () => {
    it("lists the newest active deployments with their leases", async () => {
      const { service, deploymentController } = setup();
      const { status: _status, ...lease } = createDeploymentLease({ dseq: "42", reason: "lease_closed_reason_unstable" });
      const listed = (dseq: string, name: string | null, overrides: Partial<ListDeploymentsItem> = {}): ListDeploymentsItem => {
        const { deployment, escrow_account } = createGetDeploymentResponseData({ dseq });
        return { deployment, escrow_account, leases: [], name, groups: [], settings: null, ...overrides };
      };
      deploymentController.list.mockResolvedValue({
        data: {
          deployments: [
            listed("42", "site", {
              leases: [lease],
              settings: { name: "site", runtimeLimitHours: 2, runtimeEndsAt: "2026-11-05T00:00:00.000Z", closed: false }
            }),
            listed("43", null)
          ],
          pagination: { total: 2, skip: 0, limit: 20, hasMore: false }
        }
      });

      const result = await service.listDeployments({});

      expect(deploymentController.list).toHaveBeenCalledWith({ state: "active", reverse: true, skip: 0, limit: 20, search: undefined });
      expect(result).toEqual({
        total: 2,
        hasMore: false,
        deployments: [
          {
            dseq: "42",
            name: "site",
            state: "active",
            runtimeEndsAt: "2026-11-05T00:00:00.000Z",
            leases: [
              {
                gseq: 1,
                oseq: 1,
                provider: lease.id.provider,
                state: "active",
                usdPerMonth: 438.29,
                closedReason: "lease_closed_reason_unstable",
                reclamation: null
              }
            ]
          },
          { dseq: "43", name: null, state: "active", runtimeEndsAt: null, leases: [] }
        ]
      });
    });

    it("passes the state and search through", async () => {
      const { service, deploymentController } = setup();
      deploymentController.list.mockResolvedValue({ data: { deployments: [], pagination: { total: 0, skip: 0, limit: 20, hasMore: false } } });

      await service.listDeployments({ state: "closed", search: "llama" });

      expect(deploymentController.list).toHaveBeenCalledWith({ state: "closed", reverse: true, skip: 0, limit: 20, search: "llama" });
    });
  });

  describe("getDeployment", () => {
    it("reads the deployment with lease readiness and its services without env values", async () => {
      const { service, deploymentController } = setup();
      const reclamation = { deadline: "1800000000", reason: "lease_closed_reason_reclaimed" };
      const lease = createDeploymentLease({
        dseq: "42",
        reclamation,
        status: {
          services: {
            web: {
              name: "web",
              available: 1,
              total: 1,
              uris: ["abc.provider.com"],
              observed_generation: 1,
              replicas: 1,
              updated_replicas: 1,
              ready_replicas: 1,
              available_replicas: 1
            }
          },
          forwarded_ports: {
            web: [
              { port: 22, externalPort: 31022, host: "provider.com" },
              { port: 23, externalPort: 31023 }
            ]
          },
          ips: {}
        }
      });
      const deployment = createGetDeploymentResponseData({ dseq: "42", name: "site", leases: [lease, createDeploymentLease({ dseq: "42" })] });
      deploymentController.findByDseq.mockResolvedValue({ data: deployment });

      const result = await service.getDeployment({ dseq: "42" });

      expect(deploymentController.findByDseq).toHaveBeenCalledWith("42");
      expect(result).toEqual({
        dseq: "42",
        name: "site",
        state: "active",
        templateId: null,
        escrowBalanceUsd: 5,
        leases: [
          {
            gseq: 1,
            oseq: 1,
            provider: lease.id.provider,
            state: "active",
            usdPerMonth: 438.29,
            closedReason: null,
            reclamation,
            services: [{ name: "web", available: 1, total: 1, readyReplicas: 1, uris: ["abc.provider.com"] }],
            forwardedPorts: [
              { port: 22, externalPort: 31022, host: "provider.com" },
              { port: 23, externalPort: 31023, host: null }
            ]
          },
          expect.objectContaining({ services: null, forwardedPorts: null })
        ],
        services: [expect.objectContaining({ service: "web", envKeys: ["PORT", "API_KEY"] })]
      });
      expect(JSON.stringify(result)).not.toContain("ac-secret");
    });

    it("reads a lease whose provider reports no services or forwarded ports yet", async () => {
      const { service, deploymentController } = setup();
      const providerStatus: unknown = { services: null, forwarded_ports: null, ips: null };
      const lease = createDeploymentLease({ dseq: "42", status: providerStatus as GetDeploymentResponse["data"]["leases"][number]["status"] });
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ dseq: "42", leases: [lease] }) });

      const result = await service.getDeployment({ dseq: "42" });

      expect(result.leases).toEqual([expect.objectContaining({ services: [], forwardedPorts: [] })]);
    });

    it("reports no services when Console holds no SDL or it does not parse", async () => {
      const { service, deploymentController, sdlService } = setup();
      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({ sdl: null }) });

      expect((await service.getDeployment({ dseq: "42" })).services).toBeNull();

      deploymentController.findByDseq.mockResolvedValue({ data: createGetDeploymentResponseData({}) });
      sdlService.parse.mockReturnValue({ ok: false, value: [] });
      expect((await service.getDeployment({ dseq: "42" })).services).toBeNull();
    });
  });

  describe("getLeaseCloseReason", () => {
    it("combines lease close reasons, Console's own reason and the deployment's recent activity", async () => {
      const { service, deploymentController, deploymentSettingController, activityController } = setup();
      const lease = createDeploymentLease({ dseq: "42", state: "closed", closed_on: "123", reason: "lease_closed_reason_insufficient_funds" });
      deploymentController.findByDseq.mockResolvedValue({
        data: createGetDeploymentResponseData({ dseq: "42", name: "site", state: "closed", leases: [lease] })
      });
      deploymentSettingController.findV2.mockResolvedValue({
        data: mock<DeploymentSetting>({ consoleCloseReason: "runtime_limit_reached", runtimeLimitHours: 2, runtimeEndsAt: "2026-11-04T00:00:00.000Z" })
      });
      activityController.list.mockResolvedValue({
        data: {
          activities: [
            activity({ type: "deployment_close", initiator: "system", meta: { dseq: "42", reason: "runtime_limit_reached" } }),
            activity({ type: "deployment_create", meta: { dseq: "7" } }),
            activity({ type: "deployment_update", status: "failed", meta: { dseq: "42", error: { code: "x", message: "boom" } } }),
            ...Array.from({ length: 12 }, () => activity({ type: "deployment_update", meta: { dseq: "42" } }))
          ],
          unseenCount: 0,
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        }
      });

      const result = await service.getLeaseCloseReason({ dseq: "42" });

      expect(deploymentSettingController.findV2).toHaveBeenCalledWith({ dseq: "42" });
      expect(activityController.list).toHaveBeenCalledWith({ limit: 100 });
      expect(result).toMatchObject({
        dseq: "42",
        name: "site",
        state: "closed",
        leases: [
          { provider: lease.id.provider, state: "closed", usdPerMonth: 438.29, closedOn: "123", closedReason: "lease_closed_reason_insufficient_funds" }
        ],
        consoleCloseReason: "runtime_limit_reached",
        runtimeLimitHours: 2,
        runtimeEndsAt: "2026-11-04T00:00:00.000Z"
      });
      expect(result.recentActivity).toHaveLength(10);
      expect(result.recentActivity.slice(0, 2)).toEqual([
        {
          type: "deployment_close",
          status: "succeeded",
          initiator: "system",
          reason: "runtime_limit_reached",
          error: null,
          createdAt: "2026-11-04T00:00:00.000Z"
        },
        {
          type: "deployment_update",
          status: "failed",
          initiator: "user",
          reason: null,
          error: { code: "x", message: "boom" },
          createdAt: "2026-11-04T00:00:00.000Z"
        }
      ]);
    });

    it("reports no Console reason when the deployment has no settings", async () => {
      const { service, deploymentSettingController, activityController } = setup();
      deploymentSettingController.findV2.mockRejectedValue(createError(404, "Deployment setting not found"));
      activityController.list.mockResolvedValue({ data: { activities: [], unseenCount: 0, pagination: { limit: 100, hasMore: false, nextCursor: null } } });

      expect(await service.getLeaseCloseReason({ dseq: "42" })).toMatchObject({
        consoleCloseReason: null,
        runtimeLimitHours: null,
        runtimeEndsAt: null,
        recentActivity: []
      });
    });

    it("lets other settings failures through", async () => {
      const { service, deploymentSettingController, activityController } = setup();
      deploymentSettingController.findV2.mockRejectedValue(createError(403, "Forbidden"));
      activityController.list.mockResolvedValue({ data: { activities: [], unseenCount: 0, pagination: { limit: 100, hasMore: false, nextCursor: null } } });

      await expect(service.getLeaseCloseReason({ dseq: "42" })).rejects.toThrow("Forbidden");
    });

    it("lets a failure that is not an http error through", async () => {
      const { service, deploymentSettingController, activityController } = setup();
      deploymentSettingController.findV2.mockRejectedValue(new Error("db down"));
      activityController.list.mockResolvedValue({ data: { activities: [], unseenCount: 0, pagination: { limit: 100, hasMore: false, nextCursor: null } } });

      await expect(service.getLeaseCloseReason({ dseq: "42" })).rejects.toThrow("db down");
    });
  });

  function activity(overrides: Partial<ActivityResponse>): ActivityResponse {
    return {
      id: "00000000-0000-4000-8000-000000000000",
      type: "deployment_create",
      status: "succeeded",
      initiator: "user",
      meta: {},
      seenAt: null,
      createdAt: "2026-11-04T00:00:00.000Z",
      updatedAt: "2026-11-04T00:00:00.000Z",
      ...overrides
    };
  }

  function setup() {
    const deploymentController = mock<DeploymentController>();
    deploymentController.findByDseq.mockImplementation(async dseq => ({ data: createGetDeploymentResponseData({ dseq }) }));
    const deploymentSettingController = mock<DeploymentSettingController>();
    const activityController = mock<ActivityController>();
    const sdlService = mock<SdlService>();
    sdlService.parse.mockImplementation(sdl => ({ ok: true, value: yaml.raw(sdl) }));
    const usdService = new AssistantUsdService(mock<DenomExchangeService>());
    const service = new AssistantDeploymentToolsService(deploymentController, deploymentSettingController, activityController, sdlService, usdService);

    return { service, deploymentController, deploymentSettingController, activityController, sdlService };
  }
});
