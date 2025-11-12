"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationWarning = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var ValidationWarning = function (_a) {
    var show = _a.show;
    if (!show)
        return null;
    return (<components_1.Alert className="mx-auto max-w-md text-left" variant="warning">
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-card p-3">
          <iconoir_react_1.WarningTriangle className="h-4 w-4"/>
        </div>
        <div>
          <h4 className="font-medium">Card Validation Required</h4>
          <p className="text-sm">
            You must complete the card validation process before starting your trial. Please wait for the validation to complete or try adding a different card.
          </p>
        </div>
      </div>
    </components_1.Alert>);
};
exports.ValidationWarning = ValidationWarning;
