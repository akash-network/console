import React, { useCallback, useMemo, useState } from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@akashnetwork/ui/components";
import { ClickAwayListener } from "@mui/material";
import { BadgeCheck, CheckCircle, MoreHoriz, Trash } from "iconoir-react";

import { CardBrandMark } from "@src/components/billing-usage/CardBrandMark/CardBrandMark";
import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

export const DEPENDENCIES = {
  DropdownMenu,
  DropdownMenuTrigger,
  Button,
  DropdownMenuContent,
  ClickAwayListener,
  CustomDropdownLinkItem,
  CardBrandMark
};

export type PaymentMethodsRowProps = {
  paymentMethod: PaymentMethod;
  onSetPaymentMethodAsDefault: (id: string) => void;
  onRemovePaymentMethod: (id: string) => void;
  isDisabled?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodsRow: React.FC<PaymentMethodsRowProps> = ({
  paymentMethod,
  onSetPaymentMethodAsDefault,
  onRemovePaymentMethod,
  isDisabled = false,
  dependencies: d = DEPENDENCIES
}) => {
  const [open, setOpen] = useState(false);

  function openMenu() {
    setOpen(true);
  }

  const closeMenu = () => {
    setOpen(false);
  };

  const paymentMethodLabel = useMemo(() => {
    if (paymentMethod.card) {
      return (
        <>
          {capitalizeFirstLetter(paymentMethod.card.brand || "")} {paymentMethod.card.funding} **** {paymentMethod.card.last4}
        </>
      );
    }

    if (paymentMethod.type === "link") {
      const email = paymentMethod.link?.email;
      return <>{email ? `Link (${email})` : "Link"}</>;
    }

    return <>{capitalizeFirstLetter(paymentMethod.type)}</>;
  }, [paymentMethod]);

  const validUntilContent = useMemo(() => {
    if (!paymentMethod.card) {
      return null;
    }

    const month = paymentMethod.card.exp_month?.toString().padStart(2, "0");
    return (
      <>
        {month}/{paymentMethod.card.exp_year}
      </>
    );
  }, [paymentMethod]);

  const defaultBadge = useMemo(() => {
    if (!paymentMethod.isDefault) {
      return null;
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-400">
        <BadgeCheck className="h-3 w-3" aria-hidden />
        Default
      </span>
    );
  }, [paymentMethod]);

  const setPaymentAsDefault = useCallback(() => {
    onSetPaymentMethodAsDefault(paymentMethod.id);
    closeMenu();
  }, [onSetPaymentMethodAsDefault, paymentMethod.id]);

  const removePaymentMethod = useCallback(() => {
    onRemovePaymentMethod(paymentMethod.id);
    closeMenu();
  }, [onRemovePaymentMethod, paymentMethod.id]);

  const canSetAsDefault = !paymentMethod.isDefault;

  return (
    <div className="flex items-center gap-3.5">
      <d.CardBrandMark brand={paymentMethod.card?.brand ?? paymentMethod.type} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="truncate text-[14.5px] font-medium">{paymentMethodLabel}</span>
          {defaultBadge}
        </div>
        {validUntilContent && <span className="whitespace-nowrap text-xs text-muted-foreground sm:ml-auto sm:text-sm">Valid until {validUntilContent}</span>}
      </div>
      <div className="flex shrink-0 items-center">
        <d.DropdownMenu modal={false} open={open}>
          <d.DropdownMenuTrigger asChild>
            <d.Button
              onClick={openMenu}
              disabled={isDisabled}
              size="icon"
              variant="ghost"
              className="h-[30px] w-[30px] rounded-md text-muted-foreground"
              aria-label="Payment method actions"
            >
              <MoreHoriz className="h-[17px] w-[17px]" />
            </d.Button>
          </d.DropdownMenuTrigger>
          <d.DropdownMenuContent
            align="end"
            onMouseLeave={() => setOpen(false)}
            onClick={e => {
              e.stopPropagation();
            }}
          >
            <d.ClickAwayListener onClickAway={() => setOpen(false)}>
              <div>
                {canSetAsDefault && (
                  <d.CustomDropdownLinkItem onClick={setPaymentAsDefault} icon={<CheckCircle fontSize="small" />}>
                    Set as default
                  </d.CustomDropdownLinkItem>
                )}
                <d.CustomDropdownLinkItem onClick={removePaymentMethod} icon={<Trash fontSize="small" />}>
                  Remove
                </d.CustomDropdownLinkItem>
              </div>
            </d.ClickAwayListener>
          </d.DropdownMenuContent>
        </d.DropdownMenu>
      </div>
    </div>
  );
};
