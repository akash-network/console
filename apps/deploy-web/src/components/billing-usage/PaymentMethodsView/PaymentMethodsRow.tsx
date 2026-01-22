import React, { useCallback, useMemo, useState } from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, TableCell, TableRow } from "@akashnetwork/ui/components";
import { ClickAwayListener } from "@mui/material";
import { BadgeCheck, CheckCircle, MoreHoriz, Trash } from "iconoir-react";

import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

export const DEPENDENCIES = {
  TableRow,
  TableCell,
  DropdownMenu,
  DropdownMenuTrigger,
  Button,
  DropdownMenuContent,
  ClickAwayListener,
  CustomDropdownLinkItem
};

export type PaymentMethodsRowProps = {
  paymentMethod: PaymentMethod;
  onSetPaymentMethodAsDefault: (id: string) => void;
  onRemovePaymentMethod: (id: string) => void;
  hasOtherPaymentMethods: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodsRow: React.FC<PaymentMethodsRowProps> = ({
  paymentMethod,
  onSetPaymentMethodAsDefault,
  onRemovePaymentMethod,
  hasOtherPaymentMethods,
  dependencies: d = DEPENDENCIES
}) => {
  const [open, setOpen] = useState(false);

  function openMenu() {
    setOpen(true);
  }

  const closeMenu = () => {
    setOpen(false);
  };

  const card = useCallback((paymentMethod: PaymentMethod) => {
    return (
      <>
        {capitalizeFirstLetter(paymentMethod.card?.brand || "")} {paymentMethod.card?.funding} **** {paymentMethod.card?.last4}
      </>
    );
  }, []);

  const validUntil = useCallback((paymentMethod: PaymentMethod) => {
    const month = paymentMethod.card?.exp_month?.toString().padStart(2, "0");
    return (
      <>
        {month}/{paymentMethod.card?.exp_year}
      </>
    );
  }, []);

  const defaultBadge = useMemo(() => {
    if (!paymentMethod.isDefault) {
      return null;
    }

    return (
      <Badge variant="info" className="ml-2 h-4 px-1 py-0 text-xs">
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

  return (
    <d.TableRow className="flex border-0 py-2 hover:bg-transparent">
      <d.TableCell className="flex items-center">
        {card(paymentMethod)} {defaultBadge}
      </d.TableCell>
      <d.TableCell className="flex flex-grow items-center justify-end">Valid until {validUntil(paymentMethod)}</d.TableCell>
      {hasOtherPaymentMethods && (
        <d.TableCell className="min-h-[72px] min-w-[72px]">
          {!paymentMethod.isDefault && (
            <d.DropdownMenu modal={false} open={open}>
              <d.DropdownMenuTrigger asChild>
                <d.Button onClick={openMenu} size="icon" variant="ghost" className="rounded-full">
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
                    <d.CustomDropdownLinkItem onClick={setPaymentAsDefault} icon={<CheckCircle fontSize="small" />}>
                      Set as default
                    </d.CustomDropdownLinkItem>
                    <d.CustomDropdownLinkItem onClick={removePaymentMethod} icon={<Trash fontSize="small" />}>
                      Remove
                    </d.CustomDropdownLinkItem>
                  </div>
                </d.ClickAwayListener>
              </d.DropdownMenuContent>
            </d.DropdownMenu>
          )}
        </d.TableCell>
      )}
    </d.TableRow>
  );
};
