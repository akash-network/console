import React from "react";
import { Button } from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import { useAddCredits } from "@src/hooks/useAddCredits";

const ADD_CREDITS_DESCRIPTION = "Add credits to your balance to continue.";

type Props = {
  message?: string;
  /** Where the snackbar was raised, forwarded to the sheet's lifecycle events so its call sites stay distinguishable. */
  context?: string;
  onAction?: () => void;
};

/** Renders in notistack's portal outside PopupProvider, so it opens the sheet through the jotai atom instead of AddFundsButton, whose email-verification hook calls usePopup() and would throw here. */
export const AddCreditsSnackbarContent: React.FC<Props> = ({ message, context = "insufficient_funds_snackbar", onAction }) => {
  const { analyticsService } = useServices();
  const openAddCredits = useAddCredits();

  return (
    <>
      {message && <div>{message}</div>}
      <Button
        className="mt-2 h-7 px-3 text-xs"
        onClick={() => {
          analyticsService.track("add_funds_btn_clk");
          openAddCredits({ initialTab: "purchase", description: ADD_CREDITS_DESCRIPTION, context });
          onAction?.();
        }}
      >
        Add Funds
      </Button>
    </>
  );
};
