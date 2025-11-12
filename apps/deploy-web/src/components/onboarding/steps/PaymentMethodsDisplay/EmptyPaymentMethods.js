"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyPaymentMethods = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var EmptyPaymentMethods = function () { return (<components_1.Card>
    <components_1.CardContent className="py-8 text-center">
      <div className="mb-4 flex justify-center">
        <iconoir_react_1.CreditCard className="h-16 w-16 text-muted-foreground"/>
      </div>
      <h4 className="mb-2 text-lg font-semibold">No Payment Methods</h4>
      <p className="mb-4 text-muted-foreground">You need to add a payment method to continue.</p>
    </components_1.CardContent>
  </components_1.Card>); };
exports.EmptyPaymentMethods = EmptyPaymentMethods;
