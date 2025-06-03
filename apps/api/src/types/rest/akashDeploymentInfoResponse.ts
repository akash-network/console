import type { DeploymentInfo } from "@akashnetwork/http-sdk";

export type RestAkashDeploymentInfoResponse =
  | {
      code: number;
      message: string;
      details: string[];
    }
  | DeploymentInfo;
