import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Alert, AlertDescription, AlertTitle, Button, Card, Skeleton } from "@akashnetwork/ui/components";
import { CreditCard, Plus, X } from "lucide-react";

import { useBillingActions } from "@src/components/billing-usage/BillingActionsProvider/BillingActionsProvider";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import type { StripeErrorInfo } from "@src/utils/stripeErrorHandler";
import { PaymentMethodsRow } from "./PaymentMethodsRow";

export const DEPENDENCIES = {
  useBillingActions,
  PaymentMethodsRow,
  Alert,
  AlertTitle,
  AlertDescription,
  Card,
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
    <SettingsSection title="Payment Method">
      {operationError && (
        <d.Alert variant="destructive" className="mb-3 flex items-start gap-3 p-4">
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
      <d.Card className="overflow-hidden rounded-xl shadow-none">
        <div className="p-5 sm:px-6">
          {isLoadingPaymentMethods ? (
            <div className="flex flex-col gap-5">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3.5">
                  <d.Skeleton className="h-7 w-[42px] rounded-md" />
                  <d.Skeleton className="h-4 w-48" />
                  <d.Skeleton className="ml-auto h-4 w-28" />
                </div>
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CreditCard className="h-[22px] w-[22px] text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold">No payment methods yet</p>
              <p className="text-xs text-muted-foreground">Add a card to buy credits and turn on auto recharge.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
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
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted px-5 py-3 text-[13px] text-muted-foreground sm:pl-6 sm:pr-4">
          {data.length > 0 && <span>All transactions will be made using your default payment method.</span>}
          <d.Button onClick={() => openAddPaymentMethod()} size="sm" variant="outline" disabled={isInProgress} className="ml-auto gap-1.5 bg-background">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Payment Method</span>
          </d.Button>
        </div>
      </d.Card>
    </SettingsSection>
  );
};
