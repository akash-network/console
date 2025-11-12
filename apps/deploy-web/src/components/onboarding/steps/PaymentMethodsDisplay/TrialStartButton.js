"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialStartButton = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var TrialStartButton = function (_a) {
    var isLoading = _a.isLoading, disabled = _a.disabled, onClick = _a.onClick;
    return (<div className="mx-auto flex max-w-md justify-center">
    <components_1.LoadingButton onClick={onClick} disabled={disabled} loading={isLoading} className="flex w-full items-center gap-2">
      {isLoading ? "Starting Trial..." : "Start Trial"}
    </components_1.LoadingButton>
  </div>);
};
exports.TrialStartButton = TrialStartButton;
