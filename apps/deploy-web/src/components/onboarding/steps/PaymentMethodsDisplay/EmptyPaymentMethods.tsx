import React from "react";
import { Card, CardContent } from "@akashnetwork/ui/components";
import { CreditCard } from "iconoir-react";

export const EmptyPaymentMethods: React.FC = () => (
  <Card>
    <CardContent className="py-8 text-center">
      <div className="mb-4 flex justify-center">
        <CreditCard className="h-16 w-16 text-muted-foreground" />
      </div>
      <h4 className="mb-2 text-lg font-semibold">No Payment Methods</h4>
      <p className="mb-4 text-muted-foreground">You need to add a payment method to continue.</p>
    </CardContent>
  </Card>
);
