import { usePopup } from "@akashnetwork/ui/context";
import { useWallet } from "@src/context/WalletProvider";

export const useCloseDeploymentConfirm = () => {
  const { isManaged } = useWallet();
  const { confirm } = usePopup();

  const closeDeploymentConfirm = async (dseq: string[]) => {
    if (isManaged) {
      const isConfirmed = await confirm({
        title: "Are you sure you want to close this deployment?",
        message: (
          <div className="space-y-2">
            <p>
              DSEQ <span className="space-x-2 text-sm font-bold">{dseq.map(x => x)}</span>
            </p>
            <p className="text-sm text-muted-foreground">Closing a deployment will stop all services and release any unused escrowed funds.</p>
          </div>
        )
      });

      if (!isConfirmed) {
        return false;
      }
    }

    return true;
  };

  return { closeDeploymentConfirm };
};
