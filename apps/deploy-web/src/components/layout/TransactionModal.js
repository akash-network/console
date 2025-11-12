"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionModal = void 0;
var components_1 = require("@akashnetwork/ui/components");
var TITLES = {
    waitingForApproval: "Waiting for tx approval",
    broadcasting: "Transaction Pending",
    searchingProviders: "Searching Providers",
    creatingDeployment: "Creating Deployment",
    updatingDeployment: "Updating Deployment",
    creatingLease: "Creating Lease",
    closingDeployment: "Closing Deployment",
    depositingDeployment: "Depositing Deployment"
};
var CRYPTO_STATES = ["waitingForApproval", "broadcasting"];
var TransactionModal = function (_a) {
    var state = _a.state, onClose = _a.onClose;
    return state ? (<components_1.Popup fullWidth open={!!state} variant="custom" title={<div className="text-center">{TITLES[state]}</div>} actions={[]} onClose={onClose} maxWidth="xs" enableCloseOnBackdropClick={false} hideCloseButton>
      <div className="p-4 text-center">
        <div className="mb-12 mt-8">
          <components_1.Spinner size="large" className="flex justify-center"/>
        </div>

        {CRYPTO_STATES.includes(state) && (<div className="text-sm text-muted-foreground">
            {state === "waitingForApproval" ? "APPROVE OR REJECT TX TO CONTINUE..." : "BROADCASTING TRANSACTION..."}
          </div>)}
      </div>
    </components_1.Popup>) : null;
};
exports.TransactionModal = TransactionModal;
