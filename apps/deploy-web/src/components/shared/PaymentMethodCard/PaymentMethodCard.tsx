"use client";
import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, RadioGroupItem } from "@akashnetwork/ui/components";
import { CheckCircle, CreditCard } from "iconoir-react";

interface PaymentMethodCardProps {
  method: PaymentMethod;
  isRemoving: boolean;
  onRemove: (paymentMethodId: string) => void;
  // Selection mode props
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (paymentMethodId: string) => void;
  // Display mode props
  showValidationBadge?: boolean;
  isTrialing?: boolean;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  method,
  isRemoving,
  onRemove,
  isSelectable = false,
  isSelected = false,
  onSelect,
  showValidationBadge = true,
  isTrialing = false
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

  if (isSelectable) {
    // Selection mode - used in payment page
    return (
      <div
        className={`flex cursor-pointer items-center justify-between rounded-md border p-4 transition-colors ${
          isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
        }`}
        onClick={handleCardClick}
      >
        <div className="flex items-center gap-3">
          <RadioGroupItem value={method.id} id={method.id} />
          <div className="flex items-center gap-3">
            <div>
              <div className="text-base font-medium">
                {method.card?.brand?.toUpperCase()} •••• {method.card?.last4}
              </div>
              <div className="text-sm text-muted-foreground">
                Expires {method.card?.exp_month}/{method.card?.exp_year}
              </div>
            </div>
          </div>
        </div>
        {!isTrialing && (
          <Button variant="ghost" size="sm" onClick={handleRemoveClick} disabled={isRemoving}>
            Remove
          </Button>
        )}
      </div>
    );
  }

  // Display mode - used in onboarding
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-left text-base">
                {method.card?.brand?.toUpperCase()} •••• {method.card?.last4}
              </CardTitle>
              <CardDescription>
                Expires {method.card?.exp_month}/{method.card?.exp_year}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showValidationBadge && method.validated && (
              <Badge variant="success" className="flex items-center p-1">
                <CheckCircle className="h-4 w-4" />
              </Badge>
            )}
            <Button onClick={handleRemoveClick} variant="ghost" size="sm" disabled={isRemoving} className="text-muted-foreground">
              Remove
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};
