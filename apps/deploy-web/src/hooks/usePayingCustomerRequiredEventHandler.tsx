import type { MouseEventHandler } from "react";
import { useCallback } from "react";
import { Alert } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";

import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";

export const usePayingCustomerRequiredEventHandler = (): ((messageOtherwise: string) => (callback: MouseEventHandler) => MouseEventHandler) => {
  const { requireAction } = usePopup();
  const user = useUser();
  const { isTrialing, isManaged } = useWallet();

  return useCallback(
    (messageOtherwise: string) => (handler: MouseEventHandler) => {
      const preventer: MouseEventHandler = event => {
        event.preventDefault();
        requireAction({
          message: (
            <Alert className="my-2" variant="warning">
              {messageOtherwise}
            </Alert>
          ),
          actions: [
            {
              label: "Add Funds",
              side: "right",
              size: "lg",
              onClick: () => {
                window.location.href = "/api/proxy/v1/checkout";
              }
            }
          ]
        });
      };

      return user?.userId && isManaged && !isTrialing ? handler : preventer;
    },
    [isTrialing, isManaged, requireAction, user?.userId]
  );
};
