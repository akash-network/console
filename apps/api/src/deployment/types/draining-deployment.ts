import type { AutoTopUpDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";

export type DrainingDeployment = AutoTopUpDeployment & {
  predictedClosedHeight: number;
  blockRate: number;
};

export type RpcDeploymentInfo = {
  dseq: string;
  escrowBalance: bigint;
  createdHeight: number;
};

export interface DrainingDeploymentLeaseSource {
  findManyByDseqAndOwner(closureHeight: number, owner: string, dseqs: string[]): Promise<DrainingDeploymentOutput[]>;
}
