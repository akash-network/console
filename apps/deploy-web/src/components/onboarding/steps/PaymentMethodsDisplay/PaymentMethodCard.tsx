import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { CheckCircle, CreditCard } from "iconoir-react";

interface PaymentMethodCardProps {
  method: PaymentMethod;
  isRemoving: boolean;
  onRemove: (paymentMethodId: string) => void;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ method, isRemoving, onRemove }) => (
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
          {method.validated && (
            <Badge variant="success" className="flex items-center p-1">
              <CheckCircle className="h-4 w-4" />
            </Badge>
          )}
          <Button onClick={() => onRemove(method.id)} variant="ghost" size="sm" disabled={isRemoving} className="text-muted-foreground">
            Remove
          </Button>
        </div>
      </div>
    </CardHeader>
  </Card>
);
