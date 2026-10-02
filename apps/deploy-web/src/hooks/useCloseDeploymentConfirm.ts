import { useCallback } from "react";
import { useSetAtom } from "jotai";

import type { CloseDeploymentTarget } from "@src/components/deployments/CloseDeploymentDialog/CloseDeploymentDialog";
import type { DeploymentCloseReasonInput } from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";
import { useServices } from "@src/context/ServicesProvider";
import { closeDeploymentRequestAtom } from "@src/store/closeDeploymentStore";

/** Resolves to the reason the user gave for closing, or null when they backed out. */
export function useCloseDeploymentConfirm() {
  const requestConfirmation = useSetAtom(closeDeploymentRequestAtom);
  const { api } = useServices();
  const { mutate: updateDeploymentSetting } = api.v2.updateDeploymentSetting.useMutation();

  const confirmCloseDeployment = useCallback(
    (target: CloseDeploymentTarget) => new Promise<DeploymentCloseReasonInput | null>(resolve => requestConfirmation({ target, resolve })),
    [requestConfirmation]
  );

  const recordCloseReason = useCallback(
    (dseqs: string[], reason: DeploymentCloseReasonInput) => {
      for (const dseq of dseqs) {
        updateDeploymentSetting({ dseq, data: reason });
      }
    },
    [updateDeploymentSetting]
  );

  return { confirmCloseDeployment, recordCloseReason };
}
