import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { Button, Card, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { CreditCard } from "iconoir-react";

interface PaymentMethodCardProps {
  method: PaymentMethod;
  isValidated: boolean;
  isRemoving: boolean;
  onRemove: (paymentMethodId: string) => void;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ method, isValidated, isRemoving, onRemove }) => (
  <Card className="relative">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">
              {method.card?.brand?.toUpperCase()} •••• {method.card?.last4}
            </CardTitle>
            <CardDescription>
              Expires {method.card?.exp_month}/{method.card?.exp_year}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isValidated && <div className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Validated</div>}
          <Button onClick={() => onRemove(method.id)} variant="ghost" size="sm" disabled={isRemoving} className="text-destructive hover:text-destructive/80">
            Remove
          </Button>
        </div>
      </div>
    </CardHeader>
  </Card>
);
