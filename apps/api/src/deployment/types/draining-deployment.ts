import type { AutoTopUpDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";

export type DrainingDeployment = AutoTopUpDeployment & {
  predictedClosedHeight: number;
  blockRate: number;
};

export type RpcDeploymentInfo = {
  dseq: string;
  escrowBalance: number;
  createdHeight: number;
};

export interface LeaseQueryResult {
  drainingDeployments: DrainingDeploymentOutput[];
  activeDseqs: Set<string>;
}

export interface DrainingDeploymentLeaseSource {
  findManyByDseqAndOwner(closureHeight: number, owner: string, dseqs: string[]): Promise<LeaseQueryResult>;
}
