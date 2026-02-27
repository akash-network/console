import type { MouseEventHandler } from "react";
import { useCallback } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";

export const useEmailVerificationRequiredEventHandler = (): ((messageOtherwise: string) => (callback: MouseEventHandler) => MouseEventHandler) => {
  const { requireAction } = usePopup();
  const { user } = useCustomUser();
  const { enqueueSnackbar } = useSnackbar();
  const { auth, analyticsService } = useServices();

  return useCallback(
    (messageOtherwise: string) => (handler: MouseEventHandler) => {
      const preventer: MouseEventHandler = event => {
        event.preventDefault();
        requireAction({
          message: messageOtherwise,
          actions: ({ close }) => [
            {
              label: "Send verification code",
              side: "left",
              size: "lg",
              onClick: () => {
                analyticsService.track("resend_verification_email_btn_clk", "Amplitude");
                if (!user?.id) {
                  return;
                }

                auth
                  .sendVerificationCode()
                  .then(() => {
                    enqueueSnackbar(
                      <Snackbar
                        title="Verification code sent"
                        subTitle="Please check your email for the 6-digit code and verify in the onboarding page"
                        iconVariant="success"
                      />,
                      {
                        variant: "success"
                      }
                    );
                  })
                  .catch(() => {
                    enqueueSnackbar(<Snackbar title="Failed to send code" subTitle="Please try again later or contact support" iconVariant="error" />, {
                      variant: "error"
                    });
                  })
                  .finally(close);
              }
            }
          ]
        });
      };

      return user?.emailVerified ? handler : preventer;
    },
    [user?.emailVerified, user?.id, requireAction, enqueueSnackbar, auth, analyticsService]
  );
};
