import React from "react";
import { Button, Card, CardContent, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  created: number;
}

interface PaymentMethodsListProps {
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId?: string;
  onPaymentMethodSelect: (id: string) => void;
  onRemovePaymentMethod: (id: string) => void;
  isRemovingPaymentMethod: boolean;
}

export const PaymentMethodsList: React.FC<PaymentMethodsListProps> = ({
  paymentMethods,
  selectedPaymentMethodId,
  onPaymentMethodSelect,
  onRemovePaymentMethod,
  isRemovingPaymentMethod
}) => {
  if (paymentMethods.length === 0) {
    return <p className="text-gray-500">No payment methods added yet.</p>;
  }

  return (
    <div className="space-y-3">
      <Card className="rounded-lg border shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-4">
          <RadioGroup value={selectedPaymentMethodId} onValueChange={onPaymentMethodSelect} className="space-y-2">
            {paymentMethods.map(method => (
              <div
                key={method.id}
                className={`flex cursor-pointer items-center justify-between rounded-md border p-4 transition-colors ${
                  selectedPaymentMethodId === method.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
                }`}
                onClick={() => onPaymentMethodSelect(method.id)}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={method.id} id={method.id} />
                  <div>
                    <span className="font-medium capitalize">{method.card.brand}</span>
                    <span className="ml-2">•••• {method.card.last4}</span>
                    <div className="text-sm text-muted-foreground">
                      Expires {method.card.exp_month}/{method.card.exp_year}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    onRemovePaymentMethod(method.id);
                  }}
                  disabled={isRemovingPaymentMethod}
                >
                  Remove
                </Button>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
};
