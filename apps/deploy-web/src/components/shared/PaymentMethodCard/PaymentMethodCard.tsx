"use client";
import React, { useMemo } from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, RadioGroupItem } from "@akashnetwork/ui/components";
import { CheckCircle, CreditCard } from "iconoir-react";

import { capitalizeFirstLetter } from "@src/utils/stringUtils";

export const DEPENDENCIES = {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  RadioGroupItem,
  CheckCircle,
  CreditCard
};

function getPaymentMethodDisplay(method: PaymentMethod): { label: string; expiry: string | null } {
  if (method.card) {
    return {
      label: `${method.card.brand?.toUpperCase() || ""} •••• ${method.card.last4 || ""}`,
      expiry: `Expires ${method.card.exp_month}/${method.card.exp_year}`
    };
  }

  if (method.type === "link") {
    const email = method.link?.email;
    return {
      label: email ? `Link (${email})` : "Link",
      expiry: null
    };
  }

  return {
    label: capitalizeFirstLetter(method.type),
    expiry: null
  };
}

interface PaymentMethodCardProps {
  method: PaymentMethod;
  isRemoving: boolean;
  onRemove: (paymentMethodId: string) => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (paymentMethodId: string) => void;
  showValidationBadge?: boolean;
  isTrialing?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  method,
  isRemoving,
  onRemove,
  isSelectable = false,
  isSelected = false,
  onSelect,
  showValidationBadge = true,
  isTrialing = false,
  dependencies: d = DEPENDENCIES
}) => {
  const handleCardClick = () => {
    if (isSelectable && onSelect) {
      onSelect(method.id);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(method.id);
  };

  const display = useMemo(() => getPaymentMethodDisplay(method), [method]);

  if (isSelectable) {
    // Selection mode - used in payment page
    return (
      <div
        className={`flex cursor-pointer items-center justify-between rounded-md border p-4 transition-colors ${
          isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
        }`}
        onClick={handleCardClick}
      >
        <div className="flex items-center gap-4">
          <d.RadioGroupItem value={method.id} id={method.id} />
          <div className="flex items-center gap-4">
            <div>
              <div className="text-base font-medium">{display.label}</div>
              {display.expiry && <div className="text-sm text-muted-foreground">{display.expiry}</div>}
            </div>
          </div>
        </div>
        {!isTrialing && (
          <d.Button variant="ghost" size="sm" onClick={handleRemoveClick} disabled={isRemoving}>
            Remove
          </d.Button>
        )}
      </div>
    );
  }

  // Display mode - used in onboarding
  return (
    <d.Card className="relative">
      <d.CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <d.CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <d.CardTitle className="text-left text-base">{display.label}</d.CardTitle>
              {display.expiry && <d.CardDescription>{display.expiry}</d.CardDescription>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showValidationBadge && method.validated && (
              <d.Badge variant="success" className="flex items-center p-1">
                <d.CheckCircle className="h-4 w-4" />
              </d.Badge>
            )}
            <d.Button onClick={handleRemoveClick} variant="ghost" size="sm" disabled={isRemoving} className="text-muted-foreground">
              Remove
            </d.Button>
          </div>
        </div>
      </d.CardHeader>
    </d.Card>
  );
};
