import type { MouseEventHandler } from "react";
import { useCallback } from "react";
import { usePopup } from "@akashnetwork/ui/context";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

export const useLoginRequiredEventHandler = (): ((messageOtherwise: string) => (callback: MouseEventHandler) => MouseEventHandler) => {
  const { requireAction } = usePopup();
  const { user } = useUser();
  const { authService } = useServices();

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
                window.location.href = UrlService.login();
              }
            },
            {
              label: "Sign up",
              side: "right",
              size: "lg",
              onClick: () => {
                authService.signup();
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
