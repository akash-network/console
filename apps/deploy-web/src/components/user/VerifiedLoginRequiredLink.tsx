import React from "react";
import { Button } from "@akashnetwork/ui/components";
import Link, { LinkProps } from "next/link";

import { useAddFundsVerifiedLoginRequiredEventHandler } from "@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler";
import { FCWithChildren } from "@src/types/component";

export const VerifiedLoginRequiredLink: FCWithChildren<
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
    LinkProps & {
      children?: React.ReactNode;
      disabled?: boolean;
    } & React.RefAttributes<HTMLAnchorElement>
> = props => {
  const whenLoggedInAndVerified = useAddFundsVerifiedLoginRequiredEventHandler();

  return props.disabled ? (
    <Button className={props.className} disabled>
      {props.children}
    </Button>
  ) : (
    <Link {...props} onClick={whenLoggedInAndVerified(props.onClick || (() => {}))} />
  );
};
