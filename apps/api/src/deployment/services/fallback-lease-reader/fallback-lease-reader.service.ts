import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { singleton } from "tsyringe";

import { USDC_IBC_DENOMS } from "@src/billing/config/network.config";
import { type FallbackLeaseListResponse } from "@src/deployment/http-schemas/lease-rpc.schema";
import { DatabaseLeaseListParams, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { env } from "@src/utils/env";

@singleton()
export class FallbackLeaseReaderService {
  constructor(private readonly leaseRepository: LeaseRepository) {}

  public async list(params: DatabaseLeaseListParams): Promise<FallbackLeaseListResponse> {
    const { skip = 0, limit = 100, key, countTotal = true } = params;

    const { count: total, rows: leases } = await this.leaseRepository.findLeasesWithPagination(params);

    const transformedLeases = (leases || []).map(lease => this.transformLease(lease));

    // Calculate next_key similar to HTTP service
    const offset = key ? parseInt(key, 10) || 0 : skip;
    const hasMore = offset + limit < total;
    const nextKey = hasMore ? (offset + limit).toString() : null;

    return {
      leases: transformedLeases,
      pagination: {
        next_key: nextKey,
        total: countTotal ? total.toString() : "0"
      }
    };
  }

  private transformLease(lease: Lease): FallbackLeaseListResponse["leases"][number] {
    const isActive = !lease.closedHeight;
    const state = isActive ? "active" : "closed";
    const mappedDenom = this.mapDenom(lease.denom);

    return {
      lease: {
        id: {
          owner: lease.owner,
          dseq: lease.dseq,
          gseq: lease.gseq,
          oseq: lease.oseq,
          provider: lease.providerAddress,
          bseq: 0 // Default value since bseq is not available in the database lease
        },
        state,
        price: {
          denom: mappedDenom,
          amount: lease.price.toFixed(18)
        },
        created_at: lease.createdHeight.toString(),
        closed_on: lease.closedHeight?.toString() || "0",
        reason: undefined // Optional field, not available in database lease
      },
      escrow_payment: {
        id: {
          aid: {
            scope: "deployment",
            xid: `${lease.owner}/${lease.dseq}`
          },
          xid: `${lease.gseq}/${lease.oseq}/${lease.providerAddress}`
        },
        state: {
          owner: lease.providerAddress,
          state: isActive ? "open" : "closed",
          rate: {
            denom: mappedDenom,
            amount: lease.price.toFixed(18)
          },
          balance: {
            denom: mappedDenom,
            amount: "0.000000000000000000"
          },
          unsettled: {
            denom: mappedDenom,
            amount: "0.000000000000000000"
          },
          withdrawn: {
            denom: mappedDenom,
            amount: lease.withdrawnAmount.toFixed(18)
          }
        }
      }
    };
  }

  private mapDenom(denom: string): string {
    if (denom === "uusdc") {
      const network = env.NETWORK;
      if (network === "mainnet") {
        return USDC_IBC_DENOMS.mainnetId;
      } else if (network === "sandbox") {
        return USDC_IBC_DENOMS.sandboxId;
      }
      // Default to mainnet if network is not recognized
      return USDC_IBC_DENOMS.mainnetId;
    }
    return denom;
  }
}
