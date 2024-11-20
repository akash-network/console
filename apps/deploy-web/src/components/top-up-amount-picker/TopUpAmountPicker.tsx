import React from "react";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { MoreHoriz } from "iconoir-react";

import { LoginRequiredLink } from "@src/components/user/LoginRequiredLink";
import { useUser } from "@src/hooks/useUser";
import { useStripePricesQuery } from "@src/queries/useStripePricesQuery";
import { FCWithChildren } from "@src/types/component";

interface TopUpAmountPickerProps {
  popoverClassName?: string;
  fullWidth?: boolean;
}

export const TopUpAmountPicker: FCWithChildren<TopUpAmountPickerProps> = ({ children, popoverClassName, fullWidth }) => {
  const user = useUser();
  const { data = [] } = useStripePricesQuery({ enabled: !!user?.userId });

  return data.length ? (
    <span className={cn({ "w-full": fullWidth }, "group relative")}>
      <span className={cn({ "w-full": fullWidth }, "inline-flex content-center")}>
        {children}
        <Button size="icon" variant="ghost" className="ml-2 min-w-max rounded-full md:hidden">
          <MoreHoriz />
        </Button>
      </span>
      <div
        className={cn(
          "opacity-1 invisible max-h-0 overflow-hidden rounded bg-white transition-all duration-200 ease-out group-hover:visible group-hover:max-h-24 group-hover:opacity-100",
          popoverClassName
        )}
      >
        {data.map(price => {
          return (
            <LoginRequiredLink
              key={price.unitAmount || "custom"}
              className={cn("mr-1 mt-2", buttonVariants({ variant: "default" }))}
              href={`/api/proxy/v1/checkout${price.isCustom ? "" : `?amount=${price.unitAmount}`}`}
              message="Sign In or Sign Up to add funds to your balance"
            >
              {price.isCustom ? "Custom" : "$"}
              {price.unitAmount}
            </LoginRequiredLink>
          );
        })}
      </div>
    </span>
  ) : (
    <>{children}</>
  );
};
