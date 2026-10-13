import type { MouseEventHandler } from "react";
import { useCallback } from "react";
import flow from "lodash/flow";

import { useEmailVerificationRequiredEventHandler } from "@src/hooks/useEmailVerificationRequiredEventHandler";
import { useLoginRequiredEventHandler } from "@src/hooks/useLoginRequiredEventHandler";

export const ADD_FUNDS_EMAIL_VERIFICATION_MESSAGE = "Verify your email to add funds to your balance.";

export const useAddFundsVerifiedLoginRequiredEventHandler = (): ((callback: MouseEventHandler) => MouseEventHandler) => {
  const whenLoggedIn = useLoginRequiredEventHandler();
  const whenEmailIsVerified = useEmailVerificationRequiredEventHandler();

  return useCallback(
    (handler: MouseEventHandler) =>
      flow(whenEmailIsVerified(ADD_FUNDS_EMAIL_VERIFICATION_MESSAGE), whenLoggedIn("Sign In or Sign Up to add funds to your balance"))(handler),
    [whenEmailIsVerified, whenLoggedIn]
  );
};
