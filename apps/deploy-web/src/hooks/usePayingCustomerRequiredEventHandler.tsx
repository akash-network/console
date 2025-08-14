import type { MouseEventHandler } from "react";
import { useCallback } from "react";
import { Alert } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { useRouter } from "next/navigation";

import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

export const usePayingCustomerRequiredEventHandler = (): ((messageOtherwise: string) => (callback: MouseEventHandler) => MouseEventHandler) => {
  const { requireAction } = usePopup();
  const user = useUser();
  const { isTrialing, isManaged } = useWallet();
  const router = useRouter();

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
          actions: ({ close }) => [
            {
              label: "Add Funds",
              side: "right",
              size: "lg",
              onClick: () => {
                router.push(UrlService.payment());
                close();
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
