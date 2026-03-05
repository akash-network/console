import type { MouseEventHandler } from "react";
import { useCallback } from "react";
import { usePopup } from "@akashnetwork/ui/context";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export const useLoginRequiredEventHandler = (): ((messageOtherwise: string) => (callback: MouseEventHandler) => MouseEventHandler) => {
  const { requireAction } = usePopup();
  const { user } = useUser();
  const { urlService } = useServices();
  const router = useRouter();

  return useCallback(
    (messageOtherwise: string) => (handler: MouseEventHandler) => {
      const preventer: MouseEventHandler = event => {
        event.preventDefault();
        requireAction({
          message: messageOtherwise,
          actions: [
            {
              label: "Sign in",
              side: "left",
              size: "lg",
              variant: "secondary",
              onClick: () => {
                router.push(urlService.newLogin());
              }
            },
            {
              label: "Sign up",
              side: "right",
              size: "lg",
              onClick: () => {
                router.push(urlService.newSignup());
              }
            }
          ]
        });
      };

      return user?.userId ? handler : preventer;
    },
    [user?.userId, requireAction]
  );
};
