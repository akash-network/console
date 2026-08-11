import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Button, Card, CardContent, CardHeader, Skeleton } from "@akashnetwork/ui/components";
import { Plus } from "lucide-react";

import { useBillingActions } from "@src/components/billing-usage/BillingActionsProvider/BillingActionsProvider";
import { PaymentMethodsRow } from "./PaymentMethodsRow";

export const DEPENDENCIES = {
  useBillingActions,
  PaymentMethodsRow,
  Card,
  CardHeader,
  CardContent,
  Skeleton,
  Button
};

export type PaymentMethodsViewProps = {
  data: PaymentMethod[];
  onSetPaymentMethodAsDefault: (id: string) => void;
  onRemovePaymentMethod: (id: string) => Promise<void> | void;
  isLoadingPaymentMethods: boolean;
  isInProgress: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodsView: React.FC<PaymentMethodsViewProps> = ({
  data,
  onSetPaymentMethodAsDefault,
  onRemovePaymentMethod,
  isLoadingPaymentMethods,
  isInProgress,
  dependencies: d = DEPENDENCIES
}) => {
  const { openAddPaymentMethod } = d.useBillingActions();

  return (
    <d.Card className="overflow-hidden">
      <d.CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <h3 className="text-lg font-bold leading-none">Payment Method</h3>
          <p className="text-sm text-muted-foreground">All transactions will be made using your default card.</p>
        </div>
        <d.Button onClick={openAddPaymentMethod} size="sm" variant="outline" disabled={isInProgress} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Payment Method</span>
        </d.Button>
      </d.CardHeader>
      <d.CardContent>
        {isLoadingPaymentMethods ? (
          <div className="divide-y">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 py-4">
                <d.Skeleton className="h-6 w-6 rounded" />
                <d.Skeleton className="h-4 w-48" />
                <d.Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No payment methods added yet.</p>
        ) : (
          <div className="divide-y">
            {data.map(paymentMethod => (
              <d.PaymentMethodsRow
                key={paymentMethod.id}
                paymentMethod={paymentMethod}
                isDisabled={isInProgress}
                onSetPaymentMethodAsDefault={onSetPaymentMethodAsDefault}
                onRemovePaymentMethod={onRemovePaymentMethod}
              />
            ))}
          </div>
        )}
      </d.CardContent>
    </d.Card>
  );
};
