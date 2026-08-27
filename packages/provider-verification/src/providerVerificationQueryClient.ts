import type {
  AttestationRecord,
  AuditEscrowRecord,
  AuditorRecord,
  DiscrepancyEvent,
  ProviderBondRecord,
  ProviderSnapshotRecord,
  ProviderVerificationGraceRecord,
  Verification_Params
} from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { AttestationStatus, AuditEscrowStatus, AuditorStatus, DiscrepancyStatus } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { ProviderMaintenanceWithStatus } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { ProviderMaintenanceStatus } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Coin } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { createChainNodeWebSDK, SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";

type ChainNodeWebSDK = ReturnType<typeof createChainNodeWebSDK>;
export type VerificationQueries = Pick<
  ChainNodeWebSDK["akash"]["verification"]["v1"],
  | "getAuditors"
  | "getAuditor"
  | "getAuditEscrow"
  | "getDiscrepancy"
  | "getDiscrepancies"
  | "getParams"
  | "getProviderAttestations"
  | "getProviderAuditEscrows"
  | "getProviderBond"
  | "getProviderSnapshot"
  | "getProviderVerificationGrace"
>;
export type ProviderQueries = Pick<ChainNodeWebSDK["akash"]["provider"]["v1beta4"], "getProviderMaintenances">;

interface Pagination {
  nextKey: Uint8Array;
}

export interface ProviderVerificationGlobalState {
  params: Verification_Params | null;
  auditors: AuditorRecord[];
  discrepancies: DiscrepancyEvent[];
  observedHeight: string;
}

export interface ProviderVerificationScreeningState {
  provider: string;
  attestations: AttestationRecord[];
  grace: ProviderVerificationGraceRecord | null;
  snapshot: ProviderSnapshotRecord | null;
  observedHeight: string;
}

export interface ProviderVerificationProviderState extends ProviderVerificationScreeningState {
  auditEscrows: AuditEscrowRecord[];
  bond: ProviderBondRecord | null;
  requiredBondForCurrentTier: Coin | null;
  maintenances: ProviderMaintenanceWithStatus[];
}

export class ProviderVerificationQueryClient {
  constructor(
    private readonly verification: VerificationQueries,
    private readonly provider: ProviderQueries
  ) {}

  async getAuditor(auditor: string, height: string): Promise<AuditorRecord | null> {
    return optionalRecord(
      () => this.verification.getAuditor({ auditor }, queryOptions(height)),
      response => response.auditor
    );
  }

  async getAuditEscrow(id: string, height: string): Promise<AuditEscrowRecord | null> {
    return optionalRecord(
      () => this.verification.getAuditEscrow({ id: parseUint64(id) }, queryOptions(height)),
      response => response.escrow
    );
  }

  async getDiscrepancy(id: string, height: string): Promise<DiscrepancyEvent | null> {
    return optionalRecord(
      () => this.verification.getDiscrepancy({ id: parseUint64(id) }, queryOptions(height)),
      response => response.discrepancy
    );
  }

  async getGlobalState(height: string): Promise<ProviderVerificationGlobalState> {
    const options = queryOptions(height);
    const [paramsResponse, auditors, discrepancies] = await Promise.all([
      this.verification.getParams({}, options),
      collectPages(async pagination => {
        const response = await this.verification.getAuditors({ pagination, statusFilter: AuditorStatus.auditor_status_unspecified }, options);

        return { items: response.auditors, pagination: response.pagination };
      }),
      collectPages(async pagination => {
        const response = await this.verification.getDiscrepancies({ pagination, statusFilter: DiscrepancyStatus.discrepancy_status_unspecified }, options);

        return { items: response.discrepancies, pagination: response.pagination };
      })
    ]);

    return {
      params: paramsResponse.params ?? null,
      auditors,
      discrepancies,
      observedHeight: height
    };
  }

  async getProviderState(provider: string, height: string): Promise<ProviderVerificationProviderState> {
    const options = queryOptions(height);
    const [screening, auditEscrows, bondResponse, maintenances] = await Promise.all([
      this.getProviderScreeningState(provider, height),
      collectPages(async pagination => {
        const response = await this.verification.getProviderAuditEscrows(
          { pagination, provider, statusFilter: AuditEscrowStatus.audit_escrow_status_unspecified },
          options
        );

        return { items: response.escrows, pagination: response.pagination };
      }),
      optionalResponse(() => this.verification.getProviderBond({ provider }, options)),
      collectPages(async pagination => {
        const response = await this.provider.getProviderMaintenances(
          { pagination, provider, statusFilter: ProviderMaintenanceStatus.provider_maintenance_status_unspecified },
          options
        );

        return { items: response.maintenance, pagination: response.pagination };
      })
    ]);

    return {
      ...screening,
      auditEscrows,
      bond: bondResponse?.bond ?? null,
      requiredBondForCurrentTier: bondResponse?.requiredForCurrentTier ?? null,
      maintenances
    };
  }

  async getProviderScreeningState(provider: string, height: string): Promise<ProviderVerificationScreeningState> {
    const options = queryOptions(height);
    const [attestations, grace, snapshot] = await Promise.all([
      collectPages(async pagination => {
        const response = await this.verification.getProviderAttestations(
          { pagination, provider, statusFilter: AttestationStatus.attestation_status_unspecified },
          options
        );

        return { items: response.attestations, pagination: response.pagination };
      }),
      optionalRecord(
        () => this.verification.getProviderVerificationGrace({ provider }, options),
        response => response.grace
      ),
      optionalRecord(
        () => this.verification.getProviderSnapshot({ provider }, options),
        response => response.snapshot
      )
    ]);

    return {
      provider,
      attestations,
      grace,
      snapshot,
      observedHeight: height
    };
  }
}

export function createProviderVerificationQueryClient(baseUrl: string): ProviderVerificationQueryClient {
  const sdk = createChainNodeWebSDK({ query: { baseUrl } });
  return new ProviderVerificationQueryClient(sdk.akash.verification.v1, sdk.akash.provider.v1beta4);
}

function queryOptions(height: string) {
  return { headers: { "x-cosmos-block-height": height } };
}

async function collectPages<T>(
  fetchPage: (pagination: ReturnType<typeof pageRequest>) => Promise<{ items: T[]; pagination: Pagination | undefined }>
): Promise<T[]> {
  const items: T[] = [];
  let nextKey: Uint8Array<ArrayBufferLike> = new Uint8Array();

  do {
    const response = await fetchPage(pageRequest(nextKey));
    items.push(...response.items);
    nextKey = response.pagination?.nextKey ?? new Uint8Array();
  } while (nextKey.length > 0);

  return items;
}

function pageRequest(key: Uint8Array<ArrayBufferLike>) {
  return {
    key,
    offset: 0n,
    limit: 100n,
    countTotal: false,
    reverse: false
  };
}

function parseUint64(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`Invalid uint64 identifier: ${value}`);
  const parsed = BigInt(value);
  if (parsed > 18_446_744_073_709_551_615n) throw new Error(`Invalid uint64 identifier: ${value}`);
  return parsed;
}

async function optionalRecord<TResponse, TRecord>(
  query: () => Promise<TResponse>,
  select: (response: TResponse) => TRecord | undefined
): Promise<TRecord | null> {
  const response = await optionalResponse(query);
  return response ? (select(response) ?? null) : null;
}

async function optionalResponse<TResponse>(query: () => Promise<TResponse>): Promise<TResponse | null> {
  try {
    return await query();
  } catch (error) {
    if (error instanceof SDKError && error.code === SDKErrorCode.NotFound) return null;
    throw error;
  }
}
