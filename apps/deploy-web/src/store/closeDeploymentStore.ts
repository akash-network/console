import { atom } from "jotai";

import type { CloseDeploymentTarget } from "@src/components/deployments/CloseDeploymentDialog/CloseDeploymentDialog";
import type { DeploymentCloseReasonInput } from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";

export type CloseDeploymentRequest = {
  target: CloseDeploymentTarget;
  resolve: (reason: DeploymentCloseReasonInput | null) => void;
};

/** The pending close confirmation, hosted once for the app so a list row's menu can ask after the menu itself has unmounted. */
export const closeDeploymentRequestAtom = atom<CloseDeploymentRequest | null>(null);
