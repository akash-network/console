"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditorButton = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var AuditorsModal_1 = require("./AuditorsModal");
var AuditorButton = function (_a) {
    var provider = _a.provider;
    var _b = (0, react_1.useState)(false), isViewingAuditors = _b[0], setIsViewingAuditors = _b[1];
    var onAuditorClick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        setIsViewingAuditors(true);
    };
    var onClose = function (event) {
        event === null || event === void 0 ? void 0 : event.preventDefault();
        event === null || event === void 0 ? void 0 : event.stopPropagation();
        setIsViewingAuditors(false);
    };
    return (<>
      <components_1.Button onClick={onAuditorClick} size="icon" className="h-8 w-8 rounded-full" variant="ghost">
        <iconoir_react_1.BadgeCheck className="text-sm text-green-600" fontSize="small" color="success"/>
      </components_1.Button>

      {isViewingAuditors && <AuditorsModal_1.AuditorsModal attributes={provider.attributes || []} onClose={onClose}/>}
    </>);
};
exports.AuditorButton = AuditorButton;
