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
exports.ShellDownloadModal = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var zod_2 = require("zod");
var useProviderApiActions_1 = require("@src/hooks/useProviderApiActions");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var formSchema = zod_2.z.object({
    filePath: zod_2.z
        .string()
        .min(1, {
        message: "File path is required."
    })
        .regex(/^(?!https?:).*/i, {
        message: "Should be a valid path on the server, not a URL."
    })
});
var ShellDownloadModal = function (_a) {
    var selectedLease = _a.selectedLease, onCloseClick = _a.onCloseClick, selectedService = _a.selectedService, providerInfo = _a.providerInfo;
    var formRef = (0, react_1.useRef)(null);
    var downloadFileFromShell = (0, useProviderApiActions_1.useProviderApiActions)().downloadFileFromShell;
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            filePath: ""
        },
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, errors = form.formState.errors;
    var onSubmit = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var filePath = _b.filePath;
        return __generator(this, function (_c) {
            downloadFileFromShell(providerInfo, selectedLease.dseq, selectedLease.gseq, selectedLease.oseq, selectedService, filePath);
            analytics_service_1.analyticsService.track("downloaded_shell_file", {
                category: "deployments",
                label: "Download file from shell"
            });
            onCloseClick();
            return [2 /*return*/];
        });
    }); };
    var onDownloadClick = function (event) {
        var _a;
        event.preventDefault();
        (_a = formRef.current) === null || _a === void 0 ? void 0 : _a.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };
    return (<components_1.Popup fullWidth open variant="custom" title="Download file" actions={[
            {
                label: "Cancel",
                color: "primary",
                variant: "text",
                side: "left",
                onClick: onCloseClick
            },
            {
                label: "Download",
                color: "secondary",
                variant: "default",
                side: "right",
                disabled: !!errors.filePath,
                onClick: onDownloadClick
            }
        ]} onClose={onCloseClick} maxWidth="xs">
      <p className="text-xs text-muted-foreground">Enter the path of a file on the server to be downloaded to your computer. Example: /app/logs.txt</p>
      <components_1.Alert variant="warning" className="my-2 py-2">
        <p className="text-xs">This is an experimental feature and may not work reliably.</p>
      </components_1.Alert>

      <components_1.Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <components_1.FormField control={control} name="filePath" render={function (_a) {
            var field = _a.field;
            return <components_1.FormInput {...field} type="text" label="File path" autoFocus placeholder="Example: /app/logs.txt"/>;
        }}/>
        </form>
      </components_1.Form>
    </components_1.Popup>);
};
exports.ShellDownloadModal = ShellDownloadModal;
