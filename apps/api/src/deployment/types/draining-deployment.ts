import type { AutoTopUpDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";

export type DrainingDeployment = AutoTopUpDeployment & {
  predictedClosedHeight: number;
  blockRate: number;
};

export type ActiveLeaseRate = {
  dseq: string;
  blockRate: number;
};

export type RpcDeploymentInfo = {
  dseq: string;
  owner: string;
  denom: string;
  escrowBalance: number;
  createdHeight: number;
  isEscrowOpen: boolean;
};

export interface DrainingDeploymentLeaseSource {
  findManyByDseqAndOwner(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]>;
  findActiveLeaseRates(owner: string, dseqs: string[]): Promise<ActiveLeaseRate[]>;
}
