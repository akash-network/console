import React from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, LoadingButton } from "@akashnetwork/ui/components";
import { Check, CreditCard, Trash, WarningTriangle } from "iconoir-react";
import Link from "next/link";

import { useServices } from "@src/context/ServicesProvider";
import type { AppError } from "@src/types";
import { extractErrorMessage } from "@src/utils/errorUtils";

interface PaymentMethod {
  id: string;
  card?: {
    last4: string;
    brand: string;
    exp_month: number;
    exp_year: number;
  };
}

interface PaymentMethodsDisplayProps {
  paymentMethods: PaymentMethod[];
  onRemovePaymentMethod: (paymentMethodId: string) => void;
  onStartTrial: () => void;
  isLoading: boolean;
  isRemoving: boolean;
  managedWalletError?: AppError;
}

export const PaymentMethodsDisplay: React.FunctionComponent<PaymentMethodsDisplayProps> = ({
  paymentMethods,
  onRemovePaymentMethod,
  onStartTrial,
  isLoading,
  isRemoving,
  managedWalletError
}) => {
  const { urlService } = useServices();
  const formatCardNumber = (last4: string) => `•••• •••• •••• ${last4}`;

  const formatExpiry = (expMonth: number, expYear: number) => {
    const month = expMonth.toString().padStart(2, "0");
    const year = expYear.toString().slice(-2);
    return `${month}/${year}`;
  };

  const getErrorMessage = (error: AppError): string => {
    if (!error) return "An error occurred while starting your trial. Please try again.";
    return extractErrorMessage(error);
  };

  return (
    <div className="space-y-4">
      <Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="success">
        <div className="flex-shrink-0 rounded-full bg-card p-3">
          <Check className="h-6 w-6" />
        </div>
        <div>
          <h4 className="font-medium">Payment Method Added</h4>
          <p className="text-sm">Your payment method has been successfully added.</p>
        </div>
      </Alert>

      <Card className="mx-auto max-w-md">
        <CardHeader className="flex flex-row items-center gap-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="m-0">Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {paymentMethods.map(method => (
              <div key={method.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center space-x-3">
                  <div className="text-left">
                    <div className="font-medium">{method.card ? formatCardNumber(method.card.last4) : "Payment Method"}</div>
                    <div className="text-sm text-muted-foreground">
                      {method.card ? `${method.card.brand} • Expires ${formatExpiry(method.card.exp_month, method.card.exp_year)}` : "N/A"}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemovePaymentMethod(method.id)}
                  disabled={isRemoving}
                  className="hover:text-muted-foreground"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {managedWalletError && (
        <Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="destructive">
          <div className="flex-shrink-0 rounded-full bg-card p-3">
            <WarningTriangle className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-medium">Failed to Start Trial</h4>
            <p className="text-sm">{getErrorMessage(managedWalletError)}</p>
          </div>
        </Alert>
      )}

      <div className="mx-auto flex max-w-md justify-center">
        <LoadingButton
          onClick={onStartTrial}
          disabled={paymentMethods.length === 0 || isLoading}
          loading={isLoading}
          className="flex w-full items-center gap-2"
        >
          {isLoading ? "Starting Trial..." : "Start Trial"}
        </LoadingButton>
      </div>

      <div className="mx-auto max-w-md text-center">
        <p className="text-xs text-muted-foreground">
          By starting your trial, you agree to our{" "}
          <Link href={urlService.termsOfService()} className="text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href={urlService.privacyPolicy()} className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
};
