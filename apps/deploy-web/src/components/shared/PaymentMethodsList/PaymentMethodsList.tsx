import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { Card, CardContent, RadioGroup } from "@akashnetwork/ui/components";

import { PaymentMethodCard } from "../PaymentMethodCard/PaymentMethodCard";

interface PaymentMethodsListProps {
  paymentMethods: PaymentMethod[];
  isRemoving: boolean;
  onRemovePaymentMethod: (paymentMethodId: string) => void;
  // Selection mode props
  isSelectable?: boolean;
  selectedPaymentMethodId?: string;
  onPaymentMethodSelect?: (id: string) => void;
  // Display mode props
  showValidationBadge?: boolean;
  isTrialing?: boolean;
}

export const PaymentMethodsList: React.FC<PaymentMethodsListProps> = ({
  paymentMethods,
  isRemoving,
  onRemovePaymentMethod,
  isSelectable = false,
  selectedPaymentMethodId,
  onPaymentMethodSelect,
  showValidationBadge = true,
  isTrialing = false
}) => {
  if (paymentMethods.length === 0) {
    return <p className="text-gray-500">No payment methods added yet.</p>;
  }

  if (isSelectable) {
    // Selection mode - used in payment page
    return (
      <div className="space-y-3">
        <Card className="rounded-lg border shadow-sm">
          <CardContent className="flex flex-col gap-4 pt-6">
            <RadioGroup value={selectedPaymentMethodId} onValueChange={onPaymentMethodSelect} className="space-y-2">
              {paymentMethods.map(method => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  isRemoving={isRemoving}
                  onRemove={onRemovePaymentMethod}
                  isSelectable={true}
                  isSelected={selectedPaymentMethodId === method.id}
                  onSelect={onPaymentMethodSelect}
                  isTrialing={isTrialing}
                />
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Display mode - used in onboarding
  return (
    <div className="space-y-6">
      {paymentMethods.map(method => (
        <PaymentMethodCard key={method.id} method={method} isRemoving={isRemoving} onRemove={onRemovePaymentMethod} showValidationBadge={showValidationBadge} />
      ))}
    </div>
  );
};
