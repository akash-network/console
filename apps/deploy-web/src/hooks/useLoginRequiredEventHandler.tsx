import { MouseEventHandler, useCallback } from "react";
import { usePopup } from "@akashnetwork/ui/context";

import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

export const useLoginRequiredEventHandler = (): ((callback: MouseEventHandler, messageOtherwise: string) => MouseEventHandler) => {
  const { requireAction } = usePopup();
  const user = useUser();

  return useCallback(
    (handler: MouseEventHandler, messageOtherwise: string) => {
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
                window.location.href = UrlService.signup();
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
