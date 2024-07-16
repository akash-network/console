"use client";
import React, { ReactNode } from "react";
import { Button, ButtonProps } from "@akashnetwork/ui/components";
import { Wallet } from "iconoir-react";

import { useAnonymousUser } from "@src/hooks/useAnonymousUser";
import { useCreateFiatWalletMutation } from "@src/queries/useCreateFiatWalletMutation";
import { cn } from "@src/utils/styleUtils";

interface Props extends ButtonProps {
  children?: ReactNode;
  className?: string;
}

export const ConnectManagedWalletButton: React.FunctionComponent<Props> = ({ className = "", ...rest }) => {
  const { user } = useAnonymousUser();
  const { mutate } = useCreateFiatWalletMutation(user?.id);

  return (
    <Button variant="outline" onClick={() => mutate()} className={cn("border-primary", className)} {...rest}>
      <Wallet className="text-xs" />
      <span className="ml-2 whitespace-nowrap">Setup Fiat Wallet</span>
    </Button>
  );
};
