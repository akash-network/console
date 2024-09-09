import { usePopup } from "@akashnetwork/ui/context";

import { LeaseSpecDetail } from "@src/components/shared/LeaseSpecDetail";
import { useWallet } from "@src/context/WalletProvider";
import { ServiceType } from "@src/types";
import { useTotalWalletBalance } from "./useWalletBalance";
import { useChainParam } from "@src/context/ChainParamProvider";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";
import { FormattedNumber } from "react-intl";

export const useManagedDeploymentConfirm = () => {
  const { minDeposit } = useChainParam();
  const { walletBalance } = useTotalWalletBalance();
  const { isManaged } = useWallet();
  const { confirm } = usePopup();

  const closeDeploymentConfirm = async (dseq: string[]) => {
    if (isManaged) {
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

      if (!isConfirmed) {
        return false;
      }
    }

    return true;
  };

  const createDeploymentConfirm = async (services: ServiceType[]) => {
    if (isManaged) {
      const hasEnoughForDeposit = (walletBalance?.totalDeploymentGrantsUSD || 0) >= minDeposit.usdc;

      const isConfirmed = await confirm({
        title: "Confirm deployment creation?",
        message: (
          <div className="space-y-2">
            {!hasEnoughForDeposit && (
              <Alert variant="destructive" className="text-primary">
                <AlertTitle className="font-bold">Insufficient funds</AlertTitle>
                <AlertDescription>
                  <p>
                    You need more than{" "}
                    <FormattedNumber
                      value={minDeposit.usdc}
                      // eslint-disable-next-line react/style-prop-object
                      style="currency"
                      currency="USD"
                    />{" "}
                    available to create a deployment.
                  </p>
                  <p>
                    Current available balance:{" "}
                    <span className="font-bold">
                      <FormattedNumber
                        value={walletBalance?.totalDeploymentGrantsUSD || 0}
                        // eslint-disable-next-line react/style-prop-object
                        style="currency"
                        currency="USD"
                      />
                    </span>
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {services.map(service => {
              return (
                <Alert key={service.image}>
                  <div className="mb-2 text-sm">
                    <span className="font-bold">{service.title}</span>:{service.image}
                  </div>
                  <div className="flex items-center space-x-4 whitespace-nowrap">
                    <LeaseSpecDetail type="cpu" className="flex-shrink-0" value={service.profile?.cpu as number} />
                    {service.profile?.hasGpu && <LeaseSpecDetail type="gpu" className="flex-shrink-0" value={service.profile?.gpu as number} />}
                    <LeaseSpecDetail type="ram" className="flex-shrink-0" value={`${service.profile?.ram} ${service.profile?.ramUnit}`} />
                    <LeaseSpecDetail type="storage" className="flex-shrink-0" value={`${service.profile?.storage} ${service.profile?.storageUnit}`} />
                  </div>
                </Alert>
              );
            })}
          </div>
        )
      });

      if (!isConfirmed) {
        return false;
      }
    }

    return true;
  };

  return { closeDeploymentConfirm, createDeploymentConfirm };
};
