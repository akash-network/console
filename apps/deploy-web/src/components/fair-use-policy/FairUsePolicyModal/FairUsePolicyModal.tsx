"use client";
import { Popup } from "@akashnetwork/ui/components";

import {
  FAIR_USE_POLICY_ACCEPT_LABEL,
  FAIR_USE_POLICY_TITLE,
  FairUsePolicyContent
} from "@src/components/fair-use-policy/FairUsePolicyContent/FairUsePolicyContent";

type Props = {
  onAccept: () => void;
  isAccepting: boolean;
};

export function FairUsePolicyModal({ onAccept, isAccepting }: Props) {
  return (
    <Popup
      open
      fullWidth
      hideCloseButton
      maxWidth="sm"
      variant="custom"
      title={FAIR_USE_POLICY_TITLE}
      testId="fair-use-policy-modal"
      actions={[
        {
          label: FAIR_USE_POLICY_ACCEPT_LABEL,
          side: "right",
          color: "primary",
          className: "w-full",
          isLoading: isAccepting,
          disabled: isAccepting,
          onClick: onAccept,
          "data-testid": "fair-use-policy-accept-button"
        }
      ]}
    >
      <FairUsePolicyContent />
    </Popup>
  );
}
