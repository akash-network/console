import { MouseEventHandler, useCallback } from "react";
import flow from "lodash/flow";

import { useEmailVerificationRequiredEventHandler } from "@src/hooks/useEmailVerificationRequiredEventHandler";
import { useLoginRequiredEventHandler } from "@src/hooks/useLoginRequiredEventHandler";
import { usePayingCustomerRequiredEventHandler } from "@src/hooks/usePayingCustomerRequiredEventHandler";

export const useVerifiedPayingCustomerLoginRequiredEventHandler = (): ((callback: MouseEventHandler) => MouseEventHandler) => {
  const whenLoggedIn = useLoginRequiredEventHandler();
  const whenEmailIsVerified = useEmailVerificationRequiredEventHandler();
  const whenPayingCustomer = usePayingCustomerRequiredEventHandler();

  return useCallback(
    (handler: MouseEventHandler) =>
      flow(
        whenEmailIsVerified("Verify your email and add funds to add access this feature."),
        whenLoggedIn("Sign In or Sign Up to add access this feature."),
        whenPayingCustomer("Add funds to your balance to add access this feature.")
      )(handler),
    [whenEmailIsVerified, whenLoggedIn, whenPayingCustomer]
  );
};
