import React from "react";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { Button, Card, CardContent, CardFooter, CardHeader, Spinner, Table, TableBody } from "@akashnetwork/ui/components";
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
  Button
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
      <d.Card>
        <d.CardHeader>
          <div className="text-2xl font-bold">Payment Methods</div>
          <div className="text-gray-500">All payments to add credits will be made using your default card.</div>
        </d.CardHeader>
        <d.CardContent className="p-0">
          {data.length === 0 ? (
            <p className="py-4 text-gray-500">No payment methods added yet.</p>
          ) : (
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
          )}
        </d.CardContent>
        <d.CardFooter className="flex py-2">
          <div className="flex-grow text-gray-500">At most, 3 cards can be used at once.</div>
          <div>
            <d.Button onClick={onAddPaymentMethod} className="mb-4 mt-4">
              Add Payment Method
            </d.Button>
          </div>
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
