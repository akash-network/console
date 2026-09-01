import React from "react";
import type { ButtonProps } from "@akashnetwork/ui/components";
import { Button } from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import { useAddCredits } from "@src/hooks/useAddCredits";
import { useAddFundsVerifiedLoginRequiredEventHandler } from "@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler";
import type { AddCreditsRequest } from "@src/store/addCreditsStore";

export const DEPENDENCIES = { useServices, useAddCredits, useAddFundsVerifiedLoginRequiredEventHandler, Button };

type Props = Omit<ButtonProps, "onClick"> & {
  request?: AddCreditsRequest;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The `AddFundsLink` counterpart for call sites that sell credits in place: same click tracking and
 * login/email-verification gating, but it opens the Add Credits sheet instead of navigating to `/billing`.
 */
export const AddFundsButton: React.FC<Props> = ({ request, dependencies: d = DEPENDENCIES, ...props }) => {
  const { analyticsService } = d.useServices();
  const openAddCredits = d.useAddCredits();
  const whenLoggedInAndVerified = d.useAddFundsVerifiedLoginRequiredEventHandler();

  return (
    <d.Button
      {...props}
      onClick={event => {
        analyticsService.track("add_funds_btn_clk");
        whenLoggedInAndVerified(() => openAddCredits(request))(event);
      }}
    />
  );
};
