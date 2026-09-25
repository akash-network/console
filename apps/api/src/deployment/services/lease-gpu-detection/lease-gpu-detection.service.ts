import type { SDLInput } from "@akashnetwork/chain-sdk";
import { DeploymentHttpService, LeaseHttpService, LIVE_LEASE_STATES, type RpcLease } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import type { WalletInitialized } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type GpuProbeReading, mergeGpuProbeReadings } from "@src/deployment/lib/gpu-probe-output/gpu-probe-output";
import { findGpuServices } from "@src/deployment/lib/sdl-gpu-services/sdl-gpu-services";
import type { LeaseGpuReading } from "@src/deployment/model-schemas";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { LeaseGpuProbeService, type LeaseGpuProbeTarget } from "@src/deployment/services/lease-gpu-probe/lease-gpu-probe.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import type { ProviderAuth } from "@src/provider/services/provider/provider-proxy.service";

const PROVIDER_SCOPES = ["status", "shell"] as const;

export type LeaseGpuDetectionStatus = "read" | "no_gpu_declared" | "no_live_lease" | "nothing_readable" | "chain_unavailable";

export type LeaseGpuDetectionReport = {
  status: LeaseGpuDetectionStatus;
  readings: LeaseGpuReading[];
  /** Every service worth reading answered, so there is nothing left to come back for. */
  complete: boolean;
};

type LeaseRead = { readings: LeaseGpuReading[]; complete: boolean };

const CHAIN_UNAVAILABLE: LeaseGpuDetectionReport = { status: "chain_unavailable", readings: [], complete: false };

/** A placement that asks for a gpu, and the sequence of the group that carries it. */
type GpuPlacement = { gseq: number; name: string };

type RunningService = { name: string; replicas: number };

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

    if (!placements) return CHAIN_UNAVAILABLE;
    if (placements.size === 0) return { status: "no_gpu_declared", readings: [], complete: true };

    const leases = await this.#findLiveGpuLeases(input.wallet.address, input.dseq, placements);

    if (!leases) return CHAIN_UNAVAILABLE;
    if (leases.length === 0) return { status: "no_live_lease", readings: [], complete: false };

    const sdl = await this.#findStoredSdl(input.wallet.userId, input.dseq);
    const reads: LeaseRead[] = [];

    for (const lease of leases) {
      reads.push(await this.#readLease({ wallet: input.wallet, lease, placement: placements.get(lease.lease.id.gseq), sdl }));
    }

    const readings = reads.flatMap(read => read.readings);
    return { status: readings.length > 0 ? "read" : "nothing_readable", readings, complete: reads.every(read => read.complete) };
  }

  /** Null when the chain did not answer, which must not read as a deployment that asks for no gpu, since that ends the reads for good. */
  async #findGpuPlacements(owner: string, dseq: string): Promise<Map<number, GpuPlacement> | null> {
    const response = await this.#askChain(dseq, () => this.deploymentHttpService.findByOwnerAndDseq(owner, dseq));
    if (!response) return null;

    if (!("groups" in response)) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_CHAIN_UNAVAILABLE", dseq, code: response.code, message: response.message });
      return null;
    }

    const placements = new Map<number, GpuPlacement>();

    for (const group of response.groups) {
      const declaresGpu = group.group_spec.resources.some(resource => Number(resource.resource.gpu?.units?.val ?? 0) > 0);
      if (declaresGpu) placements.set(group.id.gseq, { gseq: group.id.gseq, name: group.group_spec.name });
    }

    return placements;
  }

  async #findLiveGpuLeases(owner: string, dseq: string, placements: Map<number, GpuPlacement>): Promise<RpcLease[] | null> {
    const responses = await this.#askChain(dseq, () => Promise.all(LIVE_LEASE_STATES.map(state => this.leaseHttpService.list({ owner, dseq, state }))));
    if (!responses) return null;

    const leases = responses.flatMap(response => response.leases).filter(lease => placements.has(lease.lease.id.gseq));
    const capped = leases.slice(0, this.config.get("LEASE_GPU_DETECTION_MAX_LEASES_PER_DEPLOYMENT"));

    if (capped.length < leases.length) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_LEASES_CAPPED", dseq, reported: leases.length, read: capped.length });
    }

    return capped;
  }

  async #askChain<T>(dseq: string, read: () => Promise<T>): Promise<T | null> {
    try {
      return await read();
    } catch (error) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_CHAIN_UNAVAILABLE", dseq, error });
      return null;
    }
  }

  async #findStoredSdl(userId: string, dseq: string): Promise<SDLInput | undefined> {
    const setting = await this.deploymentSettingRepository.findOneBy({ userId, dseq });
    if (!setting?.sdl) return undefined;

    const parsed = this.sdlService.parse(setting.sdl);
    if (parsed.ok) return parsed.value;

    this.logger.warn({ event: "LEASE_GPU_DETECTION_SDL_UNREADABLE", dseq });
    return undefined;
  }

  async #readLease(input: { wallet: WalletInitialized; lease: RpcLease; placement?: GpuPlacement; sdl: SDLInput | undefined }): Promise<LeaseRead> {
    const { provider: providerAddress, dseq, gseq, oseq } = input.lease.lease.id;
    const provider = await this.providerRepository.findActiveByAddress(providerAddress);

    if (!provider) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_PROVIDER_UNKNOWN", dseq, provider: providerAddress });
      return { readings: [], complete: false };
    }

    const auth = await this.#authorize(input.wallet.id, providerAddress);
    const running = await this.#findRunningServices(providerAddress, dseq, gseq, oseq, auth);

    if (!running?.length) return { readings: [], complete: false };

    const gpuServices = this.#selectGpuServices(running, input.sdl, input.placement, dseq);
    const services = this.#dropServicesPastReplicaCap(gpuServices, dseq);
    const readings: LeaseGpuReading[] = [];

    for (const service of services) {
      const reading = await this.#readService({
        target: { hostUri: provider.hostUri, providerAddress, dseq, gseq, oseq, service: service.name },
        replicas: service.replicas,
        walletId: input.wallet.id
      });
      if (!reading) continue;

      readings.push({
        gseq,
        oseq,
        provider: providerAddress,
        service: service.name,
        gpus: reading.gpus,
        driverVersion: reading.driverVersion,
        source: reading.source,
        detectedAt: new Date().toISOString()
      });
    }

    return { readings, complete: gpuServices.length > 0 && readings.length === services.length };
  }

  /** Every pod or none, since a service read in part lists fewer cards than it runs; stopping at the first unread pod spares the rest a session. */
  async #readService(input: { target: Omit<LeaseGpuProbeTarget, "podIndex" | "token">; replicas: number; walletId: number }): Promise<GpuProbeReading | null> {
    const { target, replicas, walletId } = input;
    const readings: GpuProbeReading[] = [];

    for (let podIndex = 0; podIndex < replicas; podIndex++) {
      const { token } = await this.#authorize(walletId, target.providerAddress);
      const result = await this.probeService.probe({ ...target, token, podIndex });

      if (result.status !== "detected") {
        this.logger.warn({
          event: "LEASE_GPU_DETECTION_UNREAD",
          dseq: target.dseq,
          provider: target.providerAddress,
          service: target.service,
          podIndex,
          status: result.status
        });
        return null;
      }

      readings.push(result.reading);
    }

    return mergeGpuProbeReadings(readings);
  }

  /** Asked for as each session opens rather than once per lease, since one lease's sessions run back to back and can outlast a single token. */
  #authorize(walletId: number, provider: string): Promise<ProviderAuth> {
    return this.providerService.toProviderAuth({ walletId, provider }, [...PROVIDER_SCOPES], {
      ttl: this.config.get("LEASE_GPU_DETECTION_PROVIDER_JWT_TTL_SECONDS")
    });
  }

  /** The sdl names which services asked for a gpu; without one every running service is a candidate, since the provider does not say. */
  #selectGpuServices(running: RunningService[], sdl: SDLInput | undefined, placement: GpuPlacement | undefined, dseq: string): RunningService[] {
    const declared = placement ? findGpuServices(sdl, placement.name) : [];
    const candidates = declared.length ? running.filter(service => declared.includes(service.name)) : running;
    const capped = candidates.slice(0, this.config.get("LEASE_GPU_DETECTION_MAX_SERVICES_PER_LEASE"));

    if (capped.length < candidates.length) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_SERVICES_CAPPED", dseq, reported: candidates.length, read: capped.length });
    }

    return capped;
  }

  /** A service with more pods than one run may read is settled unread, since reading it in part would understate what it runs. */
  #dropServicesPastReplicaCap(services: RunningService[], dseq: string): RunningService[] {
    const maxReplicas = this.config.get("LEASE_GPU_DETECTION_MAX_REPLICAS_PER_SERVICE");

    return services.filter(service => {
      if (service.replicas <= maxReplicas) return true;

      this.logger.warn({ event: "LEASE_GPU_DETECTION_REPLICAS_CAPPED", dseq, service: service.name, replicas: service.replicas, max: maxReplicas });
      return false;
    });
  }

  /** A service counts as many pods as the provider runs for it, ready or not, so a pod still starting is waited for rather than skipped. */
  async #findRunningServices(provider: string, dseq: string, gseq: number, oseq: number, auth: ProviderAuth): Promise<RunningService[] | undefined> {
    try {
      const status = await this.providerService.getLeaseStatus(provider, dseq, gseq, oseq, auth);

      return Object.entries(status.services ?? {})
        .filter(([, service]) => (service?.available ?? 0) > 0)
        .map(([name, service]) => ({ name, replicas: service.total }));
    } catch (error) {
      this.logger.warn({ event: "LEASE_GPU_DETECTION_STATUS_UNAVAILABLE", dseq, provider, error });
      return undefined;
    }
  }
}
