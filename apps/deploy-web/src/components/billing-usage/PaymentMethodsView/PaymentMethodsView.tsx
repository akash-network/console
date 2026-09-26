import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardHeader, Skeleton } from "@akashnetwork/ui/components";
import { Plus, X } from "lucide-react";

import { useBillingActions } from "@src/components/billing-usage/BillingActionsProvider/BillingActionsProvider";
import type { StripeErrorInfo } from "@src/utils/stripeErrorHandler";
import { PaymentMethodsRow } from "./PaymentMethodsRow";

export const DEPENDENCIES = {
  useBillingActions,
  PaymentMethodsRow,
  Alert,
  AlertTitle,
  AlertDescription,
  Card,
  CardHeader,
  CardContent,
  Skeleton,
  Button
};

export type PaymentMethodOperationError = StripeErrorInfo & { title: string };

export type PaymentMethodsViewProps = {
  data: PaymentMethod[];
  onSetPaymentMethodAsDefault: (id: string) => void;
  onRemovePaymentMethod: (id: string) => Promise<void> | void;
  operationError: PaymentMethodOperationError | null;
  onDismissOperationError: () => void;
  isLoadingPaymentMethods: boolean;
  isInProgress: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodsView: React.FC<PaymentMethodsViewProps> = ({
  data,
  onSetPaymentMethodAsDefault,
  onRemovePaymentMethod,
  operationError,
  onDismissOperationError,
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
        <d.Button onClick={() => openAddPaymentMethod()} size="sm" variant="outline" disabled={isInProgress} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Payment Method</span>
        </d.Button>
      </d.CardHeader>
      <d.CardContent>
        {operationError && (
          <d.Alert variant="destructive" className="mb-2 flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <d.AlertTitle>{operationError.title}</d.AlertTitle>
              <d.AlertDescription>
                <span className="block">{operationError.message}</span>
                {operationError.userAction && <span className="mt-1 block">{operationError.userAction}</span>}
              </d.AlertDescription>
            </div>
            <d.Button onClick={onDismissOperationError} size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label="Dismiss error">
              <X className="h-4 w-4" />
            </d.Button>
          </d.Alert>
        )}
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
