"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateCard = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var TemplateCard = function (_a) {
    var icon = _a.icon, title = _a.title, description = _a.description, onDeploy = _a.onDeploy, disabled = _a.disabled, isLoading = _a.isLoading;
    return (<components_1.Card className="flex flex-col bg-card">
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-4 flex justify-center rounded-md border p-2">{icon}</div>
      <div className="mb-4 flex-1 space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <components_1.Button onClick={onDeploy} disabled={disabled} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {isLoading ? <components_1.Spinner size="small"/> : "Deploy Now"}
      </components_1.Button>
    </div>
  </components_1.Card>);
};
exports.TemplateCard = TemplateCard;
