import type { SDLInput } from "@akashnetwork/chain-sdk";
import { DeploymentHttpService, LeaseHttpService, LIVE_LEASE_STATES, type RpcLease } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import type { WalletInitialized } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { findGpuServices } from "@src/deployment/lib/sdl-gpu-services/sdl-gpu-services";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { LeaseGpuInsert } from "@src/deployment/repositories/lease-gpu/lease-gpu.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { LeaseGpuProbeService } from "@src/deployment/services/lease-gpu-probe/lease-gpu-probe.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import type { ProviderAuth } from "@src/provider/services/provider/provider-proxy.service";

const PROVIDER_SCOPES = ["status", "shell"] as const;

export type LeaseGpuDetectionStatus = "read" | "no_gpu_declared" | "no_live_lease" | "nothing_readable";

export type LeaseGpuDetectionReport = {
  status: LeaseGpuDetectionStatus;
  rows: LeaseGpuInsert[];
  /** Every service worth reading answered, so there is nothing left to come back for. */
  complete: boolean;
};

/** A placement that asks for a gpu, and the sequence of the group that carries it. */
type GpuPlacement = { gseq: number; name: string };

/** Reads which gpus one deployment's leases are running, by asking each gpu service's container through the provider. */
@singleton()
export class LeaseGpuDetectionService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly providerRepository: ProviderRepository,
    private readonly providerService: ProviderService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly probeService: LeaseGpuProbeService,
    private readonly sdlService: SdlService,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: LeaseGpuDetectionService.name });
  }

  async detect(input: { wallet: WalletInitialized; dseq: string }): Promise<LeaseGpuDetectionReport> {
    const placements = await this.#findGpuPlacements(input.wallet.address, input.dseq);

    if (placements.size === 0) return { status: "no_gpu_declared", rows: [], complete: true };

    const leases = await this.#findLiveGpuLeases(input.wallet.address, input.dseq, placements);

    if (leases.length === 0) return { status: "no_live_lease", rows: [], complete: false };

    const sdl = await this.#findStoredSdl(input.wallet.userId, input.dseq);
    const rows: LeaseGpuInsert[] = [];
    let targeted = 0;

    for (const lease of leases) {
      const read = await this.#readLease({ wallet: input.wallet, lease, placement: placements.get(lease.lease.id.gseq), sdl });
      targeted += read.targeted;
      rows.push(...read.rows);
    }

    return { status: rows.length > 0 ? "read" : "nothing_readable", rows, complete: targeted > 0 && rows.length === targeted };
  }

  async #findGpuPlacements(owner: string, dseq: string): Promise<Map<number, GpuPlacement>> {
    const response = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);
    const placements = new Map<number, GpuPlacement>();

    if (!("groups" in response)) return placements;

    for (const group of response.groups) {
      const declaresGpu = group.group_spec.resources.some(resource => Number(resource.resource.gpu?.units?.val ?? 0) > 0);
      if (declaresGpu) placements.set(group.id.gseq, { gseq: group.id.gseq, name: group.group_spec.name });
    }

    return placements;
  }

  async #findLiveGpuLeases(owner: string, dseq: string, placements: Map<number, GpuPlacement>): Promise<RpcLease[]> {
    const responses = await Promise.all(LIVE_LEASE_STATES.map(state => this.leaseHttpService.list({ owner, dseq, state })));
    const leases = responses.flatMap(response => response.leases).filter(lease => placements.has(lease.lease.id.gseq));
    const capped = leases.slice(0, this.config.get("LEASE_GPU_DETECTION_MAX_LEASES_PER_DEPLOYMENT"));

    if (capped.length < leases.length) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_LEASES_CAPPED", dseq, reported: leases.length, read: capped.length });
    }

    return capped;
  }

  async #findStoredSdl(userId: string, dseq: string): Promise<SDLInput | undefined> {
    const setting = await this.deploymentSettingRepository.findOneBy({ userId, dseq });
    if (!setting?.sdl) return undefined;

    const parsed = this.sdlService.parse(setting.sdl);
    if (parsed.ok) return parsed.value;

    this.logger.warn({ event: "LEASE_GPU_DETECTION_SDL_UNREADABLE", dseq });
    return undefined;
  }

  async #readLease(input: {
    wallet: WalletInitialized;
    lease: RpcLease;
    placement?: GpuPlacement;
    sdl: SDLInput | undefined;
  }): Promise<{ targeted: number; rows: LeaseGpuInsert[] }> {
    const { provider: providerAddress, dseq, gseq, oseq } = input.lease.lease.id;
    const provider = await this.providerRepository.findActiveByAddress(providerAddress);

    if (!provider) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_PROVIDER_UNKNOWN", dseq, provider: providerAddress });
      return { targeted: 0, rows: [] };
    }

    const auth = await this.providerService.toProviderAuth({ walletId: input.wallet.id, provider: providerAddress }, [...PROVIDER_SCOPES], {
      ttl: this.config.get("LEASE_GPU_DETECTION_PROVIDER_JWT_TTL_SECONDS")
    });
    const running = await this.#findRunningServices(providerAddress, dseq, gseq, oseq, auth);

    if (!running?.length) return { targeted: 0, rows: [] };

    const services = this.#selectGpuServices(running, input.sdl, input.placement, dseq);
    const rows: LeaseGpuInsert[] = [];

    for (const service of services) {
      const result = await this.probeService.probe({ hostUri: provider.hostUri, providerAddress, token: auth.token, dseq, gseq, oseq, service });

      if (result.status !== "detected") {
        this.logger.warn({ event: "LEASE_GPU_DETECTION_UNREAD", dseq, provider: providerAddress, service, status: result.status });
        continue;
      }

      rows.push({
        userId: input.wallet.userId,
        dseq,
        gseq,
        oseq,
        provider: providerAddress,
        service,
        gpus: result.reading.gpus,
        driverVersion: result.reading.driverVersion,
        source: result.reading.source
      });
    }

    return { targeted: services.length, rows };
  }

  /** The sdl names which services asked for a gpu; without one every running service is a candidate, since the provider does not say. */
  #selectGpuServices(running: string[], sdl: SDLInput | undefined, placement: GpuPlacement | undefined, dseq: string): string[] {
    const declared = placement ? findGpuServices(sdl, placement.name) : [];
    const candidates = declared.length ? running.filter(service => declared.includes(service)) : running;
    const capped = candidates.slice(0, this.config.get("LEASE_GPU_DETECTION_MAX_SERVICES_PER_LEASE"));

    if (capped.length < candidates.length) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_SERVICES_CAPPED", dseq, reported: candidates.length, read: capped.length });
    }

    return capped;
  }

  async #findRunningServices(provider: string, dseq: string, gseq: number, oseq: number, auth: ProviderAuth): Promise<string[] | undefined> {
    try {
      const status = await this.providerService.getLeaseStatus(provider, dseq, gseq, oseq, auth);

      return Object.entries(status.services ?? {})
        .filter(([, service]) => (service?.available ?? 0) > 0)
        .map(([name]) => name);
    } catch (error) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_STATUS_UNAVAILABLE", dseq, provider, error });
      return undefined;
    }
  }
}
