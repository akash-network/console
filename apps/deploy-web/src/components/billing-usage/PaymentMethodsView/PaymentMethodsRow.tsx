import React, { useCallback, useMemo, useState } from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@akashnetwork/ui/components";
import { ClickAwayListener } from "@mui/material";
import { BadgeCheck, CheckCircle, MoreHoriz, Trash } from "iconoir-react";
import { CreditCard } from "lucide-react";

import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

export const DEPENDENCIES = {
  DropdownMenu,
  DropdownMenuTrigger,
  Button,
  DropdownMenuContent,
  ClickAwayListener,
  CustomDropdownLinkItem,
  CreditCard
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
      <Badge variant="info" className="h-4 px-1 py-0 text-xs">
        <BadgeCheck width="10px" className="mr-1" />
        <small>Default</small>
      </Badge>
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
    <div className="flex items-center gap-3 py-4">
      <d.CreditCard className="h-6 w-6 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate font-medium">{paymentMethodLabel}</span>
        {defaultBadge}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {validUntilContent && <span className="whitespace-nowrap text-sm text-muted-foreground">Valid until {validUntilContent}</span>}
        <d.DropdownMenu modal={false} open={open}>
          <d.DropdownMenuTrigger asChild>
            <d.Button onClick={openMenu} disabled={isDisabled} size="icon" variant="ghost" className="rounded-full" aria-label="Payment method actions">
              <MoreHoriz />
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
