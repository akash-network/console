"use strict";
"use client";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportCertificate = ExportCertificate;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var CodeSnippet_1 = require("@src/components/shared/CodeSnippet");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var walletUtils_1 = require("@src/utils/walletUtils");
function ExportCertificate(_a) {
    var isOpen = _a.isOpen, onClose = _a.onClose;
    var selectedWallet = (0, walletUtils_1.useSelectedWalletFromStorage)();
    (0, react_1.useEffect)(function () {
        function init() {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    analytics_service_1.analyticsService.track("export_certificate", {
                        category: "certificates",
                        label: "Export certificate"
                    });
                    return [2 /*return*/];
                });
            });
        }
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (<components_1.Popup fullWidth open={isOpen} variant="custom" title="Export certificate" actions={[
            {
                label: "Close",
                variant: "text",
                side: "right",
                onClick: onClose
            }
        ]} onClose={onClose} maxWidth="sm" enableCloseOnBackdropClick>
      {selectedWallet && selectedWallet.cert && selectedWallet.certKey ? (<div>
          <p className="mb-2 font-bold">Cert</p>
          <div className="mb-4">
            <CodeSnippet_1.CodeSnippet code={selectedWallet.cert}/>
          </div>
          <p className="mb-2 font-bold">Key</p>
          <CodeSnippet_1.CodeSnippet code={selectedWallet.certKey}/>
        </div>) : (<components_1.Alert variant="warning">
          Unable to find local certificate. Meaning you have a certificate on chain but not in the tool. We suggest you regenerate a new one to be able to use
          the tool properly.
        </components_1.Alert>)}
    </components_1.Popup>);
}
