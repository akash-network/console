import React from "react";
import Link, { LinkProps } from "next/link";

import { useLoginRequiredEventHandler } from "@src/hooks/useLoginRequiredEventHandler";
import { FCWithChildren } from "@src/types/component";

export const LoginRequiredLink: FCWithChildren<
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
    LinkProps & {
      children?: React.ReactNode;
      message: string;
    } & React.RefAttributes<HTMLAnchorElement>
> = ({ message, ...props }) => {
  const whenLoggedIn = useLoginRequiredEventHandler();
  return <Link {...props} onClick={whenLoggedIn(props.onClick || (() => {}), message)} />;
};
