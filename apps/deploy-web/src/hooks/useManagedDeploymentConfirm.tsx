import { usePopup } from "@akashnetwork/ui/context";

export const useManagedDeploymentConfirm = () => {
  const { confirm } = usePopup();

  const closeDeploymentConfirm = async (dseq: string[]) => {
    const isConfirmed = await confirm({
      title: `Are you sure you want to close ${dseq.length > 1 ? "these deployments" : "this deployment"}?`,
      message: (
        <div className="space-y-2">
          <p className="text-sm">
            DSEQ <span className="text-xs text-muted-foreground">({dseq.join(",")})</span>
          </p>
          <p className="text-sm text-muted-foreground">Closing a deployment will stop all services and release any unused escrowed funds.</p>
        </div>
      )
    });

    return isConfirmed;
  };

  return { closeDeploymentConfirm };
};
