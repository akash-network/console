import React from "react";
import { Button, ButtonProps, buttonVariants, Spinner } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { Cash } from "iconoir-react";
import Link from "next/link";

import { AddFundsLink } from "@src/components/user/AddFundsLink";
import { useUser } from "@src/hooks/useUser";
import { useStripePricesQuery } from "@src/queries/useStripePricesQuery";
import { FCWithChildren } from "@src/types/component";

interface TopUpAmountPickerProps extends ButtonProps {
  className?: string;
}

export const TopUpAmountPicker: FCWithChildren<TopUpAmountPickerProps> = ({ className, variant = "outline" }) => {
  const user = useUser();
  const { data, isLoading } = useStripePricesQuery({ enabled: !!user?.userId });
  const isInitializing = isLoading && !data;
  const { createCustom } = usePopup();

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    createCustom({
      title: "Select Coupon",
      actions: ({ close }) => [
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "right",
          onClick: close
        }
      ],
      message: (
        <>
          <p className="text-sm text-muted-foreground">Select the coupon with the amount you want to redeem.</p>

          <div className={cn("my-2 grid grid-cols-2 gap-2 sm:grid-cols-4")}>
            {data?.map(price => {
              return (
                <AddFundsLink
                  key={price.unitAmount || "custom"}
                  className={cn(buttonVariants({ variant: "outline", className: "text-foreground" }))}
                  href={`/api/proxy/v1/checkout${price.isCustom ? "" : `?amount=${price.unitAmount}`}`}
                >
                  {price.isCustom ? "Custom" : "$"}
                  {price.unitAmount}
                </AddFundsLink>
              );
            })}
          </div>

          <Link
            className="text-xs text-muted-foreground"
            href="https://docs.google.com/forms/d/e/1FAIpQLScSIE6H4zWCJn6DcW8uyLRVSJK1G7RnBqqlJR9Txpv_mxX9YQ/viewform?usp=header"
            target="_blank"
          >
            First time user? Click here to request a coupon
          </Link>
        </>
      )
    });
  };

  return (
    <Button variant={variant} className={cn(className, "space-x-2")} disabled={isInitializing} onClick={handleClick}>
      <Cash />
      <span>I have a coupon</span>
      {isInitializing && <Spinner size="small" />}
    </Button>
  );
};
