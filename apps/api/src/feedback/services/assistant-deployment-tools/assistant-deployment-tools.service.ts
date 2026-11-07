import { isHttpError } from "http-errors";
import { singleton } from "tsyringe";

import { ActivityController } from "@src/activity/controllers/activity/activity.controller";
import { MAX_ACTIVITY_PAGE_LIMIT } from "@src/activity/http-schemas/activity.schema";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import { DeploymentSettingController } from "@src/deployment/controllers/deployment-setting/deployment-setting.controller";
import type { DeploymentResponse, GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { ReadToolArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import { type SdlServiceSummary, summarizeSdl } from "@src/feedback/lib/sdl-summary/sdl-summary";
import { AssistantAddressNamesService } from "@src/feedback/services/assistant-address-names/assistant-address-names.service";
import { AssistantUsdService } from "@src/feedback/services/assistant-usd/assistant-usd.service";

const LISTED_DEPLOYMENTS_LIMIT = 20;
const RECENT_ACTIVITY_LIMIT = 10;

type Lease = Omit<DeploymentResponse["leases"][number], "status">;
type LeaseStatus = GetDeploymentResponse["data"]["leases"][number]["status"];

function leaseOf(lease: Lease, usdPerMonth: number | null, providerNames: Map<string, string>) {
  return {
    gseq: lease.id.gseq,
    oseq: lease.id.oseq,
    providerName: providerNames.get(lease.id.provider) ?? null,
    providerAddress: lease.id.provider,
    state: lease.state,
    usdPerMonth,
    closedReason: lease.reason ?? null,
    reclamation: lease.reclamation ?? null
  };
}

function leaseWithStatusOf(lease: Lease & { status?: LeaseStatus }, usdPerMonth: number | null, providerNames: Map<string, string>) {
  return {
    ...leaseOf(lease, usdPerMonth, providerNames),
    services: lease.status
      ? Object.values(lease.status.services ?? {}).map(({ name, available, total, ready_replicas, uris }) => ({
          name,
          available,
          total,
          readyReplicas: ready_replicas,
          uris
        }))
      : null,
    forwardedPorts: lease.status
      ? Object.values(lease.status.forwarded_ports ?? {})
          .flat()
          .map(({ port, externalPort, host }) => ({ port, externalPort, host: host ?? null }))
      : null
  };
}

/** Reads through the same controllers the deployment pages call, so every read carries the caller's ability and organization scope. */
@singleton()
export class AssistantDeploymentToolsService {
  constructor(
    private readonly deploymentController: DeploymentController,
    private readonly deploymentSettingController: DeploymentSettingController,
    private readonly activityController: ActivityController,
    private readonly sdlService: SdlService,
    private readonly usdService: AssistantUsdService,
    private readonly addressNamesService: AssistantAddressNamesService
  ) {}

  async listDeployments({ state, search }: ReadToolArguments<"list_deployments">) {
    const { data } = await this.deploymentController.list({ state: state ?? "active", reverse: true, skip: 0, limit: LISTED_DEPLOYMENTS_LIMIT, search });
    const providerNames = await this.#providerNamesOf(data.deployments.flatMap(({ leases }) => leases));

    return {
      total: data.pagination.total,
      hasMore: data.pagination.hasMore,
      deployments: await Promise.all(
        data.deployments.map(async deployment => {
          const usdPerMonth = await this.#usdPerMonthOfLeases(deployment.leases);

          return {
            dseq: deployment.deployment.id.dseq,
            name: deployment.name,
            state: deployment.deployment.state,
            runtimeEndsAt: deployment.settings?.runtimeEndsAt ?? null,
            leases: deployment.leases.map((lease, index) => leaseOf(lease, usdPerMonth[index], providerNames))
          };
        })
      )
    };
  }

  async getDeployment({ dseq }: ReadToolArguments<"get_deployment">) {
    const { data } = await this.deploymentController.findByDseq(dseq);
    const [usdPerMonth, escrowBalanceUsd, providerNames] = await Promise.all([
      this.#usdPerMonthOfLeases(data.leases),
      this.usdService.usdOf(data.escrow_account.state.funds),
      this.#providerNamesOf(data.leases)
    ]);

    return {
      dseq: data.deployment.id.dseq,
      name: data.name,
      state: data.deployment.state,
      templateId: data.consoleSettings?.templateId ?? null,
      escrowBalanceUsd,
      leases: data.leases.map((lease, index) => leaseWithStatusOf(lease, usdPerMonth[index], providerNames)),
      services: this.servicesOf(data.consoleSettings?.sdl)
    };
  }

  async getLeaseCloseReason({ dseq }: ReadToolArguments<"get_lease_close_reason">) {
    const [{ data }, setting, { data: activityPage }] = await Promise.all([
      this.deploymentController.findByDseq(dseq),
      this.#findSetting(dseq),
      this.activityController.list({ limit: MAX_ACTIVITY_PAGE_LIMIT })
    ]);
    const [usdPerMonth, providerNames] = await Promise.all([this.#usdPerMonthOfLeases(data.leases), this.#providerNamesOf(data.leases)]);

    return {
      dseq,
      name: data.name,
      state: data.deployment.state,
      leases: data.leases.map((lease, index) => ({ ...leaseOf(lease, usdPerMonth[index], providerNames), closedOn: lease.closed_on })),
      consoleCloseReason: setting?.consoleCloseReason ?? null,
      runtimeLimitHours: setting?.runtimeLimitHours ?? null,
      runtimeEndsAt: setting?.runtimeEndsAt ?? null,
      recentActivity: activityPage.activities
        .filter(({ meta }) => meta.dseq === dseq)
        .slice(0, RECENT_ACTIVITY_LIMIT)
        .map(({ type, status, initiator, meta, createdAt }) => ({
          type,
          status,
          initiator,
          reason: meta.reason ?? null,
          error: meta.error ?? null,
          createdAt
        }))
    };
  }

  /** The services the stored SDL declares, or null when Console holds no SDL for the deployment. */
  servicesOf(sdl: string | undefined): SdlServiceSummary[] | null {
    if (!sdl) return null;

    const parsed = this.sdlService.parse(sdl);
    return parsed.ok ? summarizeSdl(parsed.value) : null;
  }

  async #usdPerMonthOfLeases(leases: Lease[]): Promise<(number | null)[]> {
    return await Promise.all(leases.map(({ price }) => this.usdService.usdPerMonthOf([price])));
  }

  async #providerNamesOf(leases: Lease[]): Promise<Map<string, string>> {
    return await this.addressNamesService.providerNamesOf(leases.map(({ id }) => id.provider));
  }

  async #findSetting(dseq: string) {
    try {
      return (await this.deploymentSettingController.findV2({ dseq })).data;
    } catch (error) {
      if (isHttpError(error) && error.status === 404) return null;
      throw error;
    }
  }
}
