import { Block } from "@akashnetwork/database/dbSchemas";
import { Deployment, Lease, Provider, ProviderAttribute } from "@akashnetwork/database/dbSchemas/akash";
import {
  DeploymentHttpService,
  DeploymentInfo,
  DeploymentListResponse,
  FindAllParams,
  isLeaseLive,
  LeaseHttpService,
  LeaseListParams,
  RestAkashLeaseListResponse,
  RpcLease
} from "@akashnetwork/http-sdk";
import { PromisePool } from "@supercharge/promise-pool";
import { AxiosError } from "axios";
import assert from "http-assert";
import { InternalServerError, UnprocessableEntity as UnprocessableEntityError } from "http-errors";
import { Op } from "sequelize";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { WalletInitialized } from "@src/billing/repositories";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { Memoize } from "@src/caching/helpers";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  ConsoleSettings,
  DeploymentListState,
  DeploymentResponse,
  GetDeploymentResponse,
  ListDeploymentsItem
} from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DeploymentSettingRepository, type ListedDeploymentSetting } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { FallbackLeaseReaderService } from "@src/deployment/services/fallback-lease-reader/fallback-lease-reader.service";
import { leaseGpuKeyOf, type LeaseGpusByLease, LeaseGpuService } from "@src/deployment/services/lease-gpu/lease-gpu.service";
import type { OnChainGroupSpec } from "@src/deployment/utils/changed-group-resources/changed-group-resources";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import type { ProviderList } from "@src/types/provider";
import type { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import { averageBlockCountInAMonth } from "@src/utils/constants";
import { FallbackDeploymentReaderService, UNKNOWN_DB_PLACEHOLDER } from "../fallback-deployment-reader/fallback-deployment-reader.service";
import { MessageService } from "../message-service/message.service";

/** One page of a key-paged sweep, matching the default the chain client uses for an unpaginated read. */
const SWEEP_PAGE_SIZE = 1000;

/** Above this a search would sweep more of the chain than it is worth, so it is refused rather than served slowly. */
export const MAX_SEARCHABLE_DEPLOYMENTS = 5000;

type SweepPagination = { key?: string; limit: number };

type LoadDeploymentPage = (pagination: SweepPagination) => Promise<DeploymentListResponse>;

interface PageQuery {
  owner: string;
  userId: string;
  state: DeploymentListState;
  skip: number;
  limit: number;
  reverse: boolean;
}

@singleton()
export class DeploymentReaderService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly providerService: ProviderService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly fallbackDeploymentReaderService: FallbackDeploymentReaderService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly fallbackLeaseReaderService: FallbackLeaseReaderService,
    private readonly messageService: MessageService,
    private readonly walletReaderService: WalletReaderService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly authService: AuthService,
    private readonly leaseGpuService: LeaseGpuService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeploymentReaderService.name });
  }

  public async findByUserIdAndDseq(userId: string, dseq: string): Promise<GetDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const [deployment, recorded, leaseGpus] = await Promise.all([
      this.findByWalletAndDseq(wallet, dseq),
      this.findRecorded(userId, dseq),
      this.leaseGpuService.findForDeployments({ userId, dseqs: [dseq] })
    ]);

    return { ...deployment, ...recorded, leases: withLeaseGpus(deployment.leases, leaseGpus.get(dseq)) };
  }

  /**
   * What the console recorded for this deployment: its name, and the definition it stored or null when it stored
   * nothing. The chain knows only the manifest, so the SDL that produced it is ours to remember or lose; this is
   * what lets a deployment created on one device be read back on another.
   *
   * Scoped twice over, because the (dseq, userId) unique means two users holding the same dseq is an ordinary
   * state rather than a collision: the query names the caller's own id, and `accessibleBy` ANDs the same
   * condition into the SQL from the caller's ability. Either alone would be enough today; together they mean a
   * later refactor has to defeat both to leak one user's SDL to another.
   *
   * A row with no `sdl` is reported as nothing recorded rather than as a partial record. Settings reads create
   * rows lazily and deployments predating the recording leave both columns null, so an absent SDL is the common
   * case and not a broken one. The name is read off the same row and reported on its own, so a deployment
   * carrying a name but no definition still answers with the name.
   */
  private async findRecorded(userId: string, dseq: string): Promise<{ name: string | null; consoleSettings: ConsoleSettings | null }> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy({ userId, dseq });
    const name = setting?.name ?? null;

    if (!setting?.sdl || !setting.manifestVersion) {
      return { name, consoleSettings: null };
    }

    return { name, consoleSettings: { sdl: setting.sdl, manifestVersion: setting.manifestVersion } };
  }

  /** Under the same double scoping as the single read, and skipped entirely for an empty page so a list with nothing on it costs no query. */
  private async findNamesFor(userId: string, dseqs: string[]): Promise<Map<string, string | null>> {
    if (dseqs.length === 0) {
      return new Map();
    }

    return await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findNamesByDseqs({ userId, dseqs });
  }

  /** As {@link findNamesFor}, for the fuller record a list shows. The name rides the same row, so a list joining these needs no second lookup. */
  private async findSettingsFor(userId: string, dseqs: string[]): Promise<Map<string, ListedDeploymentSetting>> {
    if (dseqs.length === 0) {
      return new Map();
    }

    return await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findListedSettings({ userId, dseqs });
  }

  /** Answers every dseq asked about, with null where the console holds no name, so a caller never has to tell a missing row from an unnamed one. */
  public async findNames(userId: string, dseqs: string[]): Promise<Record<string, string | null>> {
    const names = await this.findNamesFor(userId, dseqs);

    return Object.fromEntries(dseqs.map(dseq => [dseq, names.get(dseq) ?? null]));
  }

  public async findByWalletAndDseq(wallet: WalletInitialized, dseq: string): Promise<DeploymentResponse> {
    const { deployment, leases, escrow_account } = await this.#findOnChain(wallet.address, dseq);

    const leasesWithStatus = await Promise.all(leases.map(lease => this.withLeaseStatus(wallet, lease)));

    return {
      deployment,
      leases: leasesWithStatus.map(({ lease, status }) => ({
        ...lease,
        status
      })),
      escrow_account
    };
  }

  /**
   * The same deployment with every lease status left null rather than asked of its provider: the chain reads
   * still refuse a dseq the owner does not hold, so the 404 a write depends on is unchanged.
   */
  public async findByWalletAndDseqWithoutProviderStatus(wallet: WalletInitialized, dseq: string): Promise<DeploymentResponse> {
    const { deployment } = await this.findWithGroupSpecsByWalletAndDseq(wallet, dseq);

    return deployment;
  }

  /** The group specs are null when only the database fallback answered, because it rebuilds them without names, endpoints or storage classes. */
  public async findWithGroupSpecsByWalletAndDseq(
    wallet: WalletInitialized,
    dseq: string
  ): Promise<{ deployment: DeploymentResponse; groupSpecs: OnChainGroupSpec[] | null }> {
    const { deployment, leases, escrow_account, groups } = await this.#findOnChain(wallet.address, dseq);
    const groupSpecs = deployment.hash === UNKNOWN_DB_PLACEHOLDER ? null : groups.map(group => group.group_spec);

    return { deployment: { deployment, leases: leases.map(lease => ({ ...lease, status: null })), escrow_account }, groupSpecs };
  }

  async #findOnChain(owner: string, dseq: string) {
    const deploymentResponse = await this.getDeployment(owner, dseq);
    assert(deploymentResponse, 404, "Deployment not found");

    if ("code" in deploymentResponse) {
      assert(!deploymentResponse.message?.toLowerCase().includes("deployment not found"), 404, "Deployment not found");

      this.logger.error({ event: "DEPLOYMENT_READ_REFUSED", owner, dseq, code: deploymentResponse.code, reason: deploymentResponse.message });
      throw new InternalServerError("Deployment could not be read, please retry");
    }

    const { leases } = await this.getLeaseList({ owner, dseq });

    return {
      deployment: deploymentResponse.deployment,
      leases: leases.map(({ lease }) => lease),
      escrow_account: deploymentResponse.escrow_account,
      groups: deploymentResponse.groups
    };
  }

  /**
   * A provider serves /lease/../status only while the lease is live: a closed lease answers 404, and a lease
   * whose provider went offline costs a full connect timeout. Neither yields a status, so a non-live lease is
   * reported as null without a provider round-trip. The lease itself stays in the response whatever its state.
   */
  private async withLeaseStatus(wallet: WalletInitialized, lease: RpcLease["lease"]) {
    if (!isLeaseLive(lease)) {
      return { lease, status: null };
    }

    try {
      const status = await this.providerService.getLeaseStatus(
        lease.id.provider,
        lease.id.dseq,
        lease.id.gseq,
        lease.id.oseq,
        await this.providerService.toProviderAuth({ walletId: wallet.id, provider: lease.id.provider }, ["status"])
      );
      return { lease, status };
    } catch (error) {
      this.logger.warn({
        event: "LEASE_STATUS_FETCH_FAILED",
        provider: lease.id.provider,
        dseq: lease.id.dseq,
        gseq: lease.id.gseq,
        oseq: lease.id.oseq,
        leaseState: lease.state,
        error
      });
      return { lease, status: null };
    }
  }

  /** The chain's `total` counts only the page it returned once an owner filter and an offset combine, so the count comes from the console's index. */
  public async list({
    query,
    state = "active",
    skip,
    limit,
    reverse = false,
    search
  }: {
    query: { userId: string };
    state?: DeploymentListState;
    skip: number;
    limit: number;
    reverse?: boolean;
    search?: string;
  }): Promise<{ deployments: ListDeploymentsItem[]; total: number | null; hasMore: boolean }> {
    const wallet = await this.walletReaderService.getWalletByUserId(query.userId);
    const { address: owner } = wallet;

    const {
      page,
      settings: pendingSettings,
      total,
      hasMore
    } = search
      ? await this.#findMatchingPage({ owner, userId: query.userId, state, skip, limit, reverse, search })
      : await this.#findPage({ owner, userId: query.userId, state, skip, limit, reverse });

    const [{ results: leaseResults }, settings, leaseGpus] = await Promise.all([
      PromisePool.withConcurrency(100)
        .for(page)
        .useCorrespondingResults()
        .handleError(async error => {
          throw error;
        })
        .process(async deployment => this.getLeaseList({ owner, dseq: deployment.deployment.id.dseq })),
      pendingSettings,
      this.leaseGpuService.findForDeployments({ userId: query.userId, dseqs: page.map(deployment => deployment.deployment.id.dseq) })
    ]);

    const deployments = page.map((deployment, index) => {
      const recorded = settings.get(deployment.deployment.id.dseq);

      return {
        deployment: deployment.deployment,
        groups: deployment.groups,
        leases: withLeaseGpus(
          this.#fetchedLeasesAt(leaseResults, index).map(({ lease }) => lease),
          leaseGpus.get(deployment.deployment.id.dseq)
        ),
        escrow_account: deployment.escrow_account,
        name: recorded?.name ?? null,
        settings: recorded ? toListedSettings(recorded) : null
      };
    });

    return { deployments, total, hasMore };
  }

  async #findPage({ owner, userId, state, skip, limit, reverse }: PageQuery) {
    const [response, countedTotal] = await Promise.all([
      this.getDeploymentsList({ owner, state, pagination: { offset: skip, limit, reverse } }),
      this.#countDeployments(owner, state)
    ]);
    const page = response.deployments;

    return {
      page,
      settings: this.findSettingsFor(
        userId,
        page.map(deployment => deployment.deployment.id.dseq)
      ),
      total: totalCovering({ countedTotal, skip, pageLength: page.length }),
      hasMore: !!response.pagination.next_key
    };
  }

  /** An index the console cannot count degrades `total` to what the page already proves, rather than failing a list the chain answered. */
  async #countDeployments(owner: string, state: DeploymentListState): Promise<number | null> {
    try {
      return await this.deploymentRepository.countByOwnerAndState(owner, state);
    } catch (error) {
      this.logger.warn({ event: "DEPLOYMENT_COUNT_FAILED", owner, state, error });
      return null;
    }
  }

  /**
   * A name lives in the console's database and a deployment on chain, so neither side can filter on both: the whole
   * of the requested state is loaded, matched, and only then paged. Leases are still fetched for the page alone.
   */
  async #findMatchingPage({ owner, userId, state, skip, limit, reverse, search }: PageQuery & { search: string }) {
    const everyDeployment = await this.#loadEveryDeployment(owner, state);
    const settings = await this.findSettingsFor(
      userId,
      everyDeployment.map(({ deployment }) => deployment.id.dseq)
    );

    const needle = search.toLowerCase();
    const matches = everyDeployment.filter(({ deployment }) => {
      const name = settings.get(deployment.id.dseq)?.name;
      return deployment.id.dseq.includes(needle) || !!name?.toLowerCase().includes(needle);
    });

    if (reverse) {
      matches.sort((one, other) => (BigInt(other.deployment.id.dseq) > BigInt(one.deployment.id.dseq) ? 1 : -1));
    }

    return { page: matches.slice(skip, skip + limit), settings, total: matches.length, hasMore: skip + limit < matches.length };
  }

  /**
   * A cursor only means something to the source that issued it, so an unreachable chain restarts the sweep on the
   * database rather than handing the chain's key to it mid-way, which would silently re-read from the first page.
   */
  async #loadEveryDeployment(owner: string, state: DeploymentListState): Promise<DeploymentInfo[]> {
    try {
      return await this.#sweepEveryPage(owner, state, pagination =>
        this.deploymentHttpService.findAll({ owner, state, pagination: { ...pagination, countTotal: false } })
      );
    } catch (error) {
      if (error instanceof UnprocessableEntityError || !this.shouldFallbackToDatabase(error)) {
        throw error;
      }

      this.logger.warn({ event: "DEPLOYMENT_SEARCH_FELL_BACK_TO_DATABASE", owner, state, error });

      return await this.#sweepEveryPage(owner, state, pagination => this.#loadDeploymentPageFromDatabase(owner, state, pagination));
    }
  }

  /** The database counts the state to work out whether another page follows, so a sweep that skipped the count would stop after the first one. */
  async #loadDeploymentPageFromDatabase(owner: string, state: DeploymentListState, pagination: SweepPagination): Promise<DeploymentListResponse> {
    return await this.fallbackDeploymentReaderService.findAll({ owner, state, ...pagination, countTotal: true });
  }

  async #sweepEveryPage(owner: string, state: DeploymentListState, loadPage: LoadDeploymentPage): Promise<DeploymentInfo[]> {
    const deployments: DeploymentInfo[] = [];
    let key: string | undefined;

    do {
      const response = await loadPage({ key, limit: SWEEP_PAGE_SIZE });
      deployments.push(...response.deployments);
      key = response.pagination.next_key ?? undefined;

      const moreThanTheCapExist = key ? deployments.length >= MAX_SEARCHABLE_DEPLOYMENTS : deployments.length > MAX_SEARCHABLE_DEPLOYMENTS;

      if (moreThanTheCapExist) {
        this.logger.warn({ event: "DEPLOYMENT_SEARCH_TOO_LARGE", owner, state, loaded: deployments.length });
        throw new UnprocessableEntityError(
          `More than ${MAX_SEARCHABLE_DEPLOYMENTS} deployments to search through. Page through them without a search instead.`
        );
      }
    } while (key);

    return deployments;
  }

  #fetchedLeasesAt(leaseResults: Array<RestAkashLeaseListResponse | symbol>, index: number): RestAkashLeaseListResponse["leases"] {
    const result = leaseResults[index];

    if (typeof result === "symbol") {
      throw new InternalServerError("Leases could not be fetched for every listed deployment");
    }

    return result.leases;
  }

  public async listWithResources({
    address,
    status,
    skip,
    limit,
    reverseSorting
  }: {
    address: string;
    status: "active" | "closed";
    skip?: number;
    limit?: number;
    reverseSorting?: boolean;
  }) {
    const basePagination = { limit, reverse: reverseSorting, countTotal: true as const };
    const response = await this.getDeploymentsList(
      skip === undefined
        ? { owner: address, state: status, pagination: basePagination }
        : { owner: address, state: status, pagination: { ...basePagination, offset: skip } }
    );
    const count = parseInt(response.pagination.total);

    if (!response.deployments.length) {
      return { count, results: [] };
    }

    const listedDseqs = new Set(response.deployments.map(x => x.deployment.id.dseq));
    const activeLeases = (await this.#loadEveryActiveLease(address)).filter(lease => listedDseqs.has(lease.lease.id.dseq));
    const providerMap = await this.#findLeaseProvidersByOwner(activeLeases);

    return {
      count,
      results: response.deployments.map(x => ({
        owner: x.deployment.id.owner,
        dseq: x.deployment.id.dseq,
        status: x.deployment.state,
        createdHeight: parseInt(x.deployment.created_at),
        escrowAccount: x.escrow_account,
        cpuUnits: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.cpu.units.val) * r.count).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        gpuUnits: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.gpu?.units?.val) * r.count || 0).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        memoryQuantity: x.groups
          .map(g => g.group_spec.resources.map(r => parseInt(r.resource.memory.quantity.val) * r.count).reduce((a, b) => a + b, 0))
          .reduce((a, b) => a + b, 0),
        storageQuantity: x.groups
          .map(g =>
            g.group_spec.resources
              .map(r => r.resource.storage.map(s => parseInt(s.quantity.val)).reduce((a, b) => a + b, 0) * r.count)
              .reduce((a, b) => a + b, 0)
          )
          .reduce((a, b) => a + b, 0),
        leases: activeLeases
          .filter(l => l.lease.id.dseq === x.deployment.id.dseq)
          .map(lease => {
            const provider = providerMap.get(lease.lease.id.provider);
            return {
              id: lease.lease.id.dseq + lease.lease.id.gseq + lease.lease.id.oseq,
              owner: lease.lease.id.owner,
              provider: provider
                ? {
                    ...provider,
                    address: provider.owner
                  }
                : undefined,
              dseq: lease.lease.id.dseq,
              gseq: lease.lease.id.gseq,
              oseq: lease.lease.id.oseq,
              state: lease.lease.state,
              price: lease.lease.price
            };
          })
      }))
    };
  }

  /** The chain answers an unpaged read with its first 100 leases and a cursor, so an owner holding more is read page by page. */
  async #loadEveryActiveLease(owner: string): Promise<RpcLease[]> {
    const leases: RpcLease[] = [];
    let key: string | undefined;

    do {
      const response = await this.leaseHttpService.list({ owner, state: "active", pagination: { key, limit: SWEEP_PAGE_SIZE } });
      leases.push(...response.leases);
      key = response.pagination.next_key ?? undefined;
    } while (key);

    return leases;
  }

  async #findLeaseProvidersByOwner(leases: RpcLease[]): Promise<Map<string, ProviderList>> {
    const providerAddresses = [...new Set(leases.map(lease => lease.lease.id.provider))];

    if (!providerAddresses.length) {
      return new Map();
    }

    const providers = await this.providerService.getProviderListByAddresses(providerAddresses);

    return new Map(providers.map(provider => [provider.owner, provider]));
  }

  @Memoize({ ttlInSeconds: 30, maxEntries: 500 })
  public async getDeploymentByOwnerAndDseq(owner: string, dseq: string) {
    // Quick existence check - avoids expensive blockchain HTTP call for non-existent deployments
    const count = await Deployment.count({ where: { owner, dseq } });
    if (count === 0) {
      return null;
    }

    let deploymentData: RestAkashDeploymentInfoResponse | null = null;
    try {
      deploymentData = await this.getDeployment(owner, dseq);
      assert(deploymentData, 404, "Deployment not found");

      if ("code" in deploymentData) {
        if (deploymentData.message?.toLowerCase().includes("deployment not found")) {
          return null;
        } else {
          throw new Error(deploymentData.message);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }

      throw error;
    }

    const leasesQuery = this.leaseHttpService.list({ owner, dseq });
    const relatedMessagesQuery = this.messageService.getDeploymentRelatedMessages(owner, dseq);
    const dbDeploymentQuery = Deployment.findOne({
      attributes: ["createdHeight", "closedHeight"],
      where: { owner: owner, dseq: dseq },
      include: [
        { model: Block, attributes: ["datetime"], as: "createdBlock" },
        { model: Block, attributes: ["datetime"], as: "closedBlock" },
        {
          model: Lease,
          attributes: ["createdHeight", "closedHeight", "gseq", "oseq"],
          include: [
            { model: Block, attributes: ["datetime"], as: "createdBlock" },
            { model: Block, attributes: ["datetime"], as: "closedBlock" }
          ]
        }
      ]
    });

    const [leasesData, relatedMessages, dbDeployment] = await Promise.all([leasesQuery, relatedMessagesQuery, dbDeploymentQuery]);

    const providerAddresses = leasesData.leases.map(x => x.lease.id.provider);
    const providers = await Provider.findAll({
      where: {
        owner: {
          [Op.in]: providerAddresses
        }
      },
      include: [{ model: ProviderAttribute }]
    });
    const providerMap = new Map(providers.map(p => [p.owner, p]));
    const deploymentDenom = deploymentData.escrow_account.state.funds[0]?.denom || deploymentData.escrow_account.state.transferred[0]?.denom;

    const leases = leasesData.leases.map(x => {
      const provider = providerMap.get(x.lease.id.provider);
      const group = (deploymentData as DeploymentInfo).groups.find(g => g.id.gseq === x.lease.id.gseq);
      const dbLease = dbDeployment?.leases.find(l => l.gseq === x.lease.id.gseq && l.oseq === x.lease.id.oseq);

      return {
        gseq: x.lease.id.gseq,
        oseq: x.lease.id.oseq,
        createdHeight: dbLease?.createdHeight,
        createdDate: dbLease?.createdBlock?.datetime,
        closedHeight: dbLease?.closedHeight,
        closedDate: dbLease?.closedBlock?.datetime,
        provider: provider
          ? {
              address: provider.owner,
              hostUri: provider.hostUri,
              isDeleted: !!provider.deletedHeight,
              attributes: provider.providerAttributes.map(attr => ({
                key: attr.key,
                value: attr.value
              }))
            }
          : null,
        status: x.lease.state,
        monthlyCostUDenom: Math.round(parseFloat(x.lease.price.amount) * averageBlockCountInAMonth),
        cpuUnits: group?.group_spec.resources.map(r => parseInt(r.resource.cpu.units.val) * r.count).reduce((a, b) => a + b, 0) || 0,
        gpuUnits: group?.group_spec.resources.map(r => parseInt(r.resource.gpu?.units?.val) * r.count || 0).reduce((a, b) => a + b, 0) || 0,
        memoryQuantity: group?.group_spec.resources.map(r => parseInt(r.resource.memory.quantity.val) * r.count).reduce((a, b) => a + b, 0) || 0,
        storageQuantity:
          group?.group_spec.resources
            .map(r => r.resource.storage.map(s => parseInt(s.quantity.val)).reduce((a, b) => a + b, 0) * r.count)
            .reduce((a, b) => a + b, 0) || 0
      };
    });

    return {
      owner: deploymentData.deployment.id.owner,
      dseq: deploymentData.deployment.id.dseq,
      balance: parseFloat(deploymentData.escrow_account.state.funds.reduce((sum, { amount }) => sum + parseFloat(amount), 0).toFixed(18)),
      denom: deploymentDenom,
      status: deploymentData.deployment.state,
      createdHeight: dbDeployment?.createdHeight,
      createdDate: dbDeployment?.createdBlock?.datetime,
      closedHeight: dbDeployment?.closedHeight,
      closedDate: dbDeployment?.closedBlock?.datetime,
      totalMonthlyCostUDenom: leases.map(x => x.monthlyCostUDenom).reduce((a, b) => a + b, 0),
      leases: leases,
      events: relatedMessages || [],
      other: deploymentData
    };
  }

  private async getDeployment(owner: string, dseq: string): Promise<RestAkashDeploymentInfoResponse | null> {
    try {
      return await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);
    } catch (error) {
      if (this.shouldFallbackToDatabase(error)) {
        return await this.fallbackDeploymentReaderService.findByOwnerAndDseq(owner, dseq);
      }

      throw error;
    }
  }

  private async getDeploymentsList(params: FindAllParams): Promise<DeploymentListResponse> {
    try {
      return await this.deploymentHttpService.findAll(params);
    } catch (error) {
      if (this.shouldFallbackToDatabase(error)) {
        return await this.fallbackDeploymentReaderService.findAll({
          owner: params.owner,
          state: params.state,
          skip: params.pagination?.offset,
          limit: params.pagination?.limit,
          key: params.pagination?.key,
          countTotal: params.pagination?.countTotal,
          reverse: params.pagination?.reverse
        });
      }

      throw error;
    }
  }

  private async getLeaseList(params: LeaseListParams): Promise<RestAkashLeaseListResponse> {
    try {
      return await this.leaseHttpService.list(params);
    } catch (error) {
      if (this.shouldFallbackToDatabase(error)) {
        return await this.fallbackLeaseReaderService.list(params);
      }

      throw error;
    }
  }

  /**
   * Determines if an error should trigger fallback to database services.
   * Falls back for network/connectivity issues but not for business logic errors.
   */
  private shouldFallbackToDatabase(error: unknown): boolean {
    if (error instanceof AxiosError) {
      if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
        return true;
      }

      if (error.response?.status && error.response?.status >= 500) {
        return true;
      }
    }

    if (error instanceof Error) {
      if (error.message?.toLowerCase().includes("timeout")) {
        return true;
      }

      if (
        error.message?.toLowerCase().includes("connection") &&
        (error.message.toLowerCase().includes("refused") || error.message.toLowerCase().includes("reset"))
      ) {
        return true;
      }
    }

    return false;
  }
}

/** An unanswered count stays unknown rather than being guessed at, and only a page with rows on it is evidence the index is behind. */
function totalCovering({ countedTotal, skip, pageLength }: { countedTotal: number | null; skip: number; pageLength: number }) {
  if (countedTotal === null) {
    return null;
  }

  return pageLength ? Math.max(countedTotal, skip + pageLength) : countedTotal;
}

function toListedSettings(setting: ListedDeploymentSetting) {
  return { ...setting, runtimeEndsAt: setting.runtimeEndsAt?.toISOString() ?? null };
}

/** A lease the console recorded nothing for carries neither field at all, rather than an empty one that would read as "no gpu". */
function withLeaseGpus<T extends { id: { gseq: number; oseq: number; provider: string } }>(leases: T[], byLease: LeaseGpusByLease | undefined): T[] {
  if (!byLease?.size) return leases;

  return leases.map(lease => ({ ...lease, ...byLease.get(leaseGpuKeyOf(lease.id)) }));
}
