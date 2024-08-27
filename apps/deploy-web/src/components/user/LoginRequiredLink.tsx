import React, { useCallback } from "react";
import { usePopup } from "@akashnetwork/ui/context";
import Link, { LinkProps } from "next/link";

import { useUser } from "@src/hooks/useUser";
import { FCWithChildren } from "@src/types/component";
import { UrlService } from "@src/utils/urlUtils";

export const LoginRequiredLink: FCWithChildren<
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
    LinkProps & {
      children?: React.ReactNode;
      message: string;
    } & React.RefAttributes<HTMLAnchorElement>
> = ({ message, ...props }) => {
  const { requireAction } = usePopup();
  const user = useUser();
  const showLoginPrompt = useCallback(
    () =>
      requireAction({
        message,
        actions: [
          {
            label: "Sign in",
            side: "left",
            size: "lg",
            variant: "secondary",
            onClick: () => {
              window.location.href = UrlService.login();
            }
          },
          {
            label: "Sign up",
            side: "right",
            size: "lg",
            onClick: () => {
              window.location.href = UrlService.signup();
            }
          }
        ]
      }),
    [message, requireAction]
  );

  return (
    <Link
      {...props}
      onClick={event => {
        if (!user.userId) {
          event.preventDefault();
          showLoginPrompt();
        }
      }}
    />
  );
};
