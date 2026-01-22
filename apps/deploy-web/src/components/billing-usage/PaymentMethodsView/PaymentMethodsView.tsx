import React from "react";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk";
import { Button, Card, CardContent, CardFooter, CardHeader, Spinner, Table, TableBody } from "@akashnetwork/ui/components";
import { CircularProgress } from "@mui/material";
import { Plus } from "lucide-react";
import { useTheme } from "next-themes";

import { AddPaymentMethodPopup } from "@src/components/user/payment";
import { PaymentMethodsRow } from "./PaymentMethodsRow";

export const DEPENDENCIES = {
  useTheme,
  PaymentMethodsRow,
  AddPaymentMethodPopup,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Spinner,
  Table,
  TableBody,
  Button,
  CircularProgress
};

export type PaymentMethodsViewProps = {
  data: PaymentMethod[];
  onSetPaymentMethodAsDefault: (id: string) => void;
  onRemovePaymentMethod: (id: string) => void;
  onAddPaymentMethod: () => void;
  isLoadingPaymentMethods: boolean;
  showAddPaymentMethod: boolean;
  setShowAddPaymentMethod: (value: boolean) => void;
  setupIntent: SetupIntentResponse | undefined;
  onAddCardSuccess: () => void;
  isInProgress: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodsView: React.FC<PaymentMethodsViewProps> = ({
  data,
  onSetPaymentMethodAsDefault,
  onRemovePaymentMethod,
  onAddPaymentMethod,
  isLoadingPaymentMethods,
  showAddPaymentMethod,
  setShowAddPaymentMethod,
  setupIntent,
  onAddCardSuccess,
  isInProgress,
  dependencies: d = DEPENDENCIES
}) => {
  const { resolvedTheme } = d.useTheme();
  const isDarkMode = resolvedTheme === "dark";

  if (isLoadingPaymentMethods) {
    return (
      <div className="flex h-full items-center justify-center">
        <d.Spinner size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <d.Card className="overflow-hidden">
        <d.CardHeader className="pb-0">
          <div className="text-2xl font-bold">Payment Methods</div>
          <div className="border-b-[1px] pb-4 text-sm text-gray-500">All payments to add credits will be made using your default card.</div>
        </d.CardHeader>
        <d.CardContent className="relative">
          {data.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">No payment methods added yet.</p>
          ) : (
            <>
              <d.Table>
                <d.TableBody>
                  {data.map(paymentMethod => (
                    <d.PaymentMethodsRow
                      key={paymentMethod.id}
                      paymentMethod={paymentMethod}
                      onSetPaymentMethodAsDefault={onSetPaymentMethodAsDefault}
                      onRemovePaymentMethod={onRemovePaymentMethod}
                      hasOtherPaymentMethods={data.length > 1}
                    />
                  ))}
                </d.TableBody>
              </d.Table>
              {isInProgress && (
                <div className="absolute bottom-0 left-0 right-0 top-0 flex h-[100%] w-[100%] items-center justify-center bg-background/80">
                  <d.CircularProgress color="primary" />
                </div>
              )}
            </>
          )}
        </d.CardContent>
        <d.CardFooter className="flex justify-end">
          <d.Button onClick={onAddPaymentMethod} size="sm" disabled={isInProgress} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Add Payment Method</span>
          </d.Button>
        </d.CardFooter>
      </d.Card>

      <d.AddPaymentMethodPopup
        open={showAddPaymentMethod}
        onClose={() => setShowAddPaymentMethod(false)}
        clientSecret={setupIntent?.clientSecret}
        isDarkMode={isDarkMode}
        onSuccess={onAddCardSuccess}
      />
    </div>
  );
};
