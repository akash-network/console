"use client";
import { useAtom } from "jotai";

import { CloseDeploymentDialog } from "@src/components/deployments/CloseDeploymentDialog/CloseDeploymentDialog";
import type { DeploymentCloseReasonInput } from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";
import { closeDeploymentRequestAtom } from "@src/store/closeDeploymentStore";

export const DEPENDENCIES = { CloseDeploymentDialog };

/** Hosts the single close confirmation that any call site opens through `useCloseDeploymentConfirm`. */
export function CloseDeploymentConfirmHost({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const [request, setRequest] = useAtom(closeDeploymentRequestAtom);

  if (!request) return null;

  const answer = (reason: DeploymentCloseReasonInput | null) => {
    request.resolve(reason);
    setRequest(null);
  };

  return <d.CloseDeploymentDialog target={request.target} onConfirm={answer} onCancel={() => answer(null)} />;
}
