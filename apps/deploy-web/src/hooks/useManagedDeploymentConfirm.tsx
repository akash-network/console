import { usePopup } from "@akashnetwork/ui/context";
import { LeaseSpecDetail } from "@src/components/shared/LeaseSpecDetail";
import { useWallet } from "@src/context/WalletProvider";
import { ServiceType } from "@src/types";

export const useManagedDeploymentConfirm = () => {
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
      const isConfirmed = await confirm({
        title: "Confirm deployment creation?",
        message: (
          <div className="space-y-2">
            {services.map(service => {
              return (
                <div key={service.image} className="rounded border p-4">
                  <div className="mb-2 text-sm">
                    <span className="font-bold">{service.title}</span>:{service.image}
                  </div>
                  <div className="flex items-center space-x-4 whitespace-nowrap">
                    <LeaseSpecDetail type="cpu" className="flex-shrink-0" value={service.profile?.cpu as number} />
                    {service.profile?.hasGpu && <LeaseSpecDetail type="gpu" className="flex-shrink-0" value={service.profile?.gpu as number} />}
                    <LeaseSpecDetail type="ram" className="flex-shrink-0" value={`${service.profile?.ram} ${service.profile?.ramUnit}`} />
                    <LeaseSpecDetail type="storage" className="flex-shrink-0" value={`${service.profile?.storage} ${service.profile?.storageUnit}`} />
                  </div>
                </div>
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
