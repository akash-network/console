import React from "react";
import { Button } from "@akashnetwork/ui/components";
import Link, { LinkProps } from "next/link";

import { useLoginRequiredEventHandler } from "@src/hooks/useLoginRequiredEventHandler";
import { FCWithChildren } from "@src/types/component";

export const LoginRequiredLink: FCWithChildren<
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
    LinkProps & {
      children?: React.ReactNode;
      message: string;
      disabled?: boolean;
    } & React.RefAttributes<HTMLAnchorElement>
> = ({ message, ...props }) => {
  const whenLoggedIn = useLoginRequiredEventHandler();
  return props.disabled ? (
    <Button className={props.className} disabled>
      {props.children}
    </Button>
  ) : (
    <Link {...props} onClick={whenLoggedIn(props.onClick || (() => {}), message)} />
  );
};
