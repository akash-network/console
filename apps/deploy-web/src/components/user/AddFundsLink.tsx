import React from "react";
import { Button } from "@akashnetwork/ui/components";
import Link, { LinkProps } from "next/link";

import { useAddFundsVerifiedLoginRequiredEventHandler } from "@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler";
import { analyticsService } from "@src/services/analytics/analytics.service";
import { FCWithChildren } from "@src/types/component";

export const AddFundsLink: FCWithChildren<
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
    <Link
      {...props}
      onClick={event => {
        analyticsService.track("add_funds_btn_clk");
        whenLoggedInAndVerified(props.onClick || (() => {}))(event);
      }}
    />
  );
};
