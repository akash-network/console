import React from "react";

import { useVerifiedPayingCustomerLoginRequiredEventHandler } from "@src/hooks/useVerifiedPayingCustomerLoginRequiredEventHandler";
import { FCWithChildren } from "@src/types/component";

type Props = {
  children: React.ReactElement;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

export const VerifiedPayingCustomerRequiredLink: FCWithChildren<Props> = ({ children, disabled, onClick, className, ...rest }) => {
  const whenLoggedCustomerInAndVerified = useVerifiedPayingCustomerLoginRequiredEventHandler();

  return React.cloneElement(children, {
    className,
    disabled,
    onClick: disabled ? undefined : whenLoggedCustomerInAndVerified(onClick || (() => {})),
    ...rest
  });
};
