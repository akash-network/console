"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorAlert = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var errorUtils_1 = require("@src/utils/errorUtils");
var ErrorAlert = function (_a) {
    var error = _a.error;
    if (!error)
        return null;
    return (<components_1.Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="destructive">
      <div className="flex-shrink-0 rounded-full bg-card p-3">
        <iconoir_react_1.WarningTriangle className="h-6 w-6"/>
      </div>
      <div>
        <h4 className="font-medium">Failed to Start Trial</h4>
        <p className="text-sm">{(0, errorUtils_1.extractErrorMessage)(error)}</p>
      </div>
    </components_1.Alert>);
};
exports.ErrorAlert = ErrorAlert;
