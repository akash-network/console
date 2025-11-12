"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditorsModal = void 0;
var components_1 = require("@akashnetwork/ui/components");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var LinkTo_1 = require("../shared/LinkTo");
var AuditorsModal = function (_a) {
    var attributes = _a.attributes, onClose = _a.onClose;
    var auditors = (0, useProvidersQuery_1.useAuditors)().data;
    var onWebsiteClick = function (event, website) {
        event.preventDefault();
        event.stopPropagation();
        window.open(website, "_blank");
    };
    return (<components_1.Popup fullWidth open variant="custom" title="Audited Attributes" actions={[
            {
                label: "Close",
                color: "secondary",
                variant: "text",
                side: "left",
                onClick: onClose
            }
        ]} onClose={onClose} maxWidth="md" enableCloseOnBackdropClick>
      <components_1.Table>
        <components_1.TableHeader>
          <components_1.TableRow>
            <components_1.TableHead>Key</components_1.TableHead>
            <components_1.TableHead>Value</components_1.TableHead>
            <components_1.TableHead className="text-center">Auditors</components_1.TableHead>
          </components_1.TableRow>
        </components_1.TableHeader>

        <components_1.TableBody>
          {attributes.map(function (a) {
            return (<components_1.TableRow key={a.key}>
                <components_1.TableCell>{a.key}</components_1.TableCell>
                <components_1.TableCell>{a.value}</components_1.TableCell>
                <components_1.TableCell>
                  <div className="flex flex-col items-center space-y-1">
                    {a.auditedBy
                    .filter(function (x) { return auditors === null || auditors === void 0 ? void 0 : auditors.some(function (y) { return y.address === x; }); })
                    .map(function (x) {
                    var auditor = auditors === null || auditors === void 0 ? void 0 : auditors.find(function (y) { return y.address === x; });
                    if (!auditor)
                        return null;
                    return (<div key={x}>
                            <components_1.CustomTooltip title={<div className="flex flex-col items-center space-y-2">
                                  <LinkTo_1.LinkTo onClick={function (event) { return onWebsiteClick(event, auditor.website); }}>{auditor === null || auditor === void 0 ? void 0 : auditor.website}</LinkTo_1.LinkTo>
                                  <components_1.Address address={(auditor === null || auditor === void 0 ? void 0 : auditor.address) || ""} isCopyable disableTooltip/>
                                </div>}>
                              <div>
                                <components_1.Badge variant="outline">{auditor === null || auditor === void 0 ? void 0 : auditor.name}</components_1.Badge>
                              </div>
                            </components_1.CustomTooltip>
                          </div>);
                })}
                  </div>
                </components_1.TableCell>
              </components_1.TableRow>);
        })}
        </components_1.TableBody>
      </components_1.Table>
    </components_1.Popup>);
};
exports.AuditorsModal = AuditorsModal;
