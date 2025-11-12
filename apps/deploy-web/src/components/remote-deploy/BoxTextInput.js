"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var BoxTextInput = function (_a) {
    var label = _a.label, description = _a.description, placeholder = _a.placeholder, onChange = _a.onChange;
    return (<div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">{label}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <components_1.Input onChange={onChange} placeholder={placeholder}/>
    </div>);
};
exports.default = BoxTextInput;
