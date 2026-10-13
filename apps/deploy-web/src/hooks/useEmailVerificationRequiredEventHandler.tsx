import type { MouseEventHandler } from "react";
import { useCallback } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";

export const DEPENDENCIES = { usePopup, useCustomUser, useSnackbar };

export const useEmailVerificationRequiredEventHandler = (
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): ((messageOtherwise: string) => (callback: MouseEventHandler) => MouseEventHandler) => {
  const { user } = dependencies.useCustomUser();
  const promptEmailVerification = useEmailVerificationPrompt(dependencies);

  return useCallback(
    (messageOtherwise: string) => (handler: MouseEventHandler) => {
      const preventer: MouseEventHandler = event => {
        event.preventDefault();
        promptEmailVerification(messageOtherwise);
      };

      return user?.emailVerified ? handler : preventer;
    },
    [user?.emailVerified, promptEmailVerification]
  );
};

/** The event-free counterpart, for actions started from the keyboard where there is no click to cancel. */
export const useRunWhenEmailVerified = (dependencies: typeof DEPENDENCIES = DEPENDENCIES) => {
  const { user } = dependencies.useCustomUser();
  const promptEmailVerification = useEmailVerificationPrompt(dependencies);

  return useCallback(
    (messageOtherwise: string, proceed: () => void) => {
      if (user?.emailVerified) {
        proceed();
        return;
      }

      promptEmailVerification(messageOtherwise);
    },
    [user?.emailVerified, promptEmailVerification]
  );
};

function useEmailVerificationPrompt(dependencies: typeof DEPENDENCIES) {
  const { requireAction } = dependencies.usePopup();
  const { enqueueSnackbar } = dependencies.useSnackbar();
  const { auth, analyticsService } = useServices();

  return useCallback(
    (message: string) => {
      requireAction({
        message,
        actions: ({ close }) => [
          {
            label: "Send verification code",
            side: "left",
            size: "lg",
            onClick: () => {
              analyticsService.track("send_verification_code_btn_clk", "Amplitude");

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
    },
    [requireAction, enqueueSnackbar, auth, analyticsService]
  );
}
