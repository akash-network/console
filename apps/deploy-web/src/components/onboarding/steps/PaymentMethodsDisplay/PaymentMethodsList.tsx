import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk/src/stripe/stripe.types";

import { PaymentMethodCard } from "./PaymentMethodCard";

interface PaymentMethodsListProps {
  paymentMethods: PaymentMethod[];
  isRemoving: boolean;
  onRemovePaymentMethod: (paymentMethodId: string) => void;
}

export const PaymentMethodsList: React.FC<PaymentMethodsListProps> = ({ paymentMethods, isRemoving, onRemovePaymentMethod }) => (
  <div className="space-y-4">
    {paymentMethods.map(method => {
      return <PaymentMethodCard key={method.id} method={method} isRemoving={isRemoving} onRemove={onRemovePaymentMethod} />;
    })}
  </div>
);
