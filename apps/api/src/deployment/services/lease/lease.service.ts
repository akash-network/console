import { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { singleton } from "tsyringe";

import { USDC_IBC_DENOMS } from "@src/billing/config/network.config";
import { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { type FallbackLeaseListResponse } from "@src/deployment/http-schemas/lease-rpc.schema";
import { DatabaseLeaseListParams, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { env } from "@src/utils/env";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";

@singleton()
export class LeaseService {
  constructor(
    private readonly signerService: ManagedSignerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly providerService: ProviderService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly leaseRepository: LeaseRepository,
    private readonly walletReaderService: WalletReaderService
  ) {}

  public async createLeasesAndSendManifest({
    leases,
    manifest,
    certificate,
    userId
  }: CreateLeaseRequest & { userId: string }): Promise<GetDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);

    const leaseMessages = leases.map(lease =>
      this.rpcMessageService.getCreateLeaseMsg({
        owner: wallet.address!,
        dseq: lease.dseq,
        gseq: lease.gseq,
        oseq: lease.oseq,
        provider: lease.provider
      })
    );

    await this.signerService.executeDecodedTxByUserId(wallet.userId, leaseMessages);

    for (const lease of leases) {
      const commonParams = {
        provider: lease.provider,
        dseq: lease.dseq,
        manifest: manifest
      };
      await this.providerService.sendManifest({
        ...commonParams,
        auth: await this.providerService.toProviderAuth(certificate || { walletId: wallet.id, provider: lease.provider })
      });
    }

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, leases[0].dseq);
  }

  public async listLeasesFallback(params: DatabaseLeaseListParams): Promise<FallbackLeaseListResponse> {
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

  private transformLease(lease: Lease) {
    const isActive = !lease.closedHeight;
    const state = isActive ? "active" : "closed";
    const mappedDenom = this.mapDenom(lease.denom);

    return {
      lease: {
        lease_id: {
          owner: lease.owner,
          dseq: lease.dseq,
          gseq: lease.gseq,
          oseq: lease.oseq,
          provider: lease.providerAddress
        },
        state,
        price: {
          denom: mappedDenom,
          amount: lease.price.toFixed(18)
        },
        created_at: lease.createdHeight.toString(),
        closed_on: lease.closedHeight?.toString() || "0"
      },
      escrow_payment: {
        account_id: {
          scope: "deployment",
          xid: `${lease.owner}/${lease.dseq}`
        },
        payment_id: `${lease.gseq}/${lease.oseq}/${lease.providerAddress}`,
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
        withdrawn: {
          denom: mappedDenom,
          amount: lease.withdrawnAmount.toFixed(18)
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
