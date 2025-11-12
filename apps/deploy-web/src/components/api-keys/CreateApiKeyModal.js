"use strict";
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
exports.CreateApiKeyModal = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var zod_1 = require("@hookform/resolvers/zod");
var notistack_1 = require("notistack");
var zod_2 = require("zod");
var queries_1 = require("@src/queries");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var formSchema = zod_2.z.object({
    name: zod_2.z
        .string()
        .min(1, {
        message: "Name is required."
    })
        .max(40, {
        message: "Name must be less than 40 characters."
    })
});
var CreateApiKeyModal = function (_a) {
    var isOpen = _a.isOpen, onClose = _a.onClose;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var _b = (0, queries_1.useCreateApiKey)(), createApiKey = _b.mutate, createdApiKey = _b.data, isPending = _b.isPending;
    var formRef = (0, react_1.useRef)(null);
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            name: ""
        },
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, errors = form.formState.errors;
    var isCreatingNewKey = !createdApiKey;
    var apiKey = (createdApiKey === null || createdApiKey === void 0 ? void 0 : createdApiKey.apiKey) || "";
    var actions = (0, react_1.useMemo)(function () {
        return isCreatingNewKey
            ? [
                {
                    label: "Cancel",
                    color: "primary",
                    variant: "secondary",
                    side: "left",
                    onClick: onClose
                },
                {
                    label: "Create Key",
                    color: "secondary",
                    variant: "default",
                    side: "right",
                    disabled: !!errors.name || isPending,
                    isLoading: isPending,
                    onClick: function (event) {
                        var _a;
                        event.preventDefault();
                        (_a = formRef.current) === null || _a === void 0 ? void 0 : _a.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
                    }
                }
            ]
            : [
                {
                    label: "Done",
                    color: "primary",
                    variant: "secondary",
                    side: "right",
                    onClick: onClose
                }
            ];
    }, [isCreatingNewKey, isPending, errors.name, onClose]);
    var onCopyClick = function () {
        (0, utils_1.copyTextToClipboard)(apiKey);
        enqueueSnackbar(<components_1.Snackbar title="Copied to clipboard!" iconVariant="success"/>, { variant: "success", autoHideDuration: 1500 });
    };
    var createApiKeyTracked = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var name = _b.name;
        return __generator(this, function (_c) {
            analytics_service_1.analyticsService.track("create_api_key", {
                category: "settings",
                label: "Create API key"
            });
            createApiKey(name);
            return [2 /*return*/];
        });
    }); };
    return (<components_1.Popup fullWidth open={isOpen} variant="custom" title={isCreatingNewKey ? "Create new secret key" : "Save your key"} actions={actions} onClose={onClose} maxWidth="sm" enableCloseOnBackdropClick>
      {isCreatingNewKey ? (<components_1.Form {...form}>
          <form onSubmit={handleSubmit(createApiKeyTracked)} ref={formRef}>
            <div className="py-4">
              <components_1.FormField control={control} name="name" render={function (_a) {
                var field = _a.field;
                return <components_1.FormInput {...field} type="text" label="Name" autoFocus placeholder="My Test Key"/>;
            }}/>
            </div>
          </form>
        </components_1.Form>) : (<div>
          <p className="text-sm text-muted-foreground">
            Please save your secret key in a safe place since <b>you won't be able to view it again.</b> Keep it secure, as anyone with your API key can make
            requests on your behalf. If you lose it, you'll need to create a new one.
          </p>

          <div className="mb-2 mt-8 flex w-full items-center gap-2">
            <components_1.Input type="text" value={apiKey} className="flex-grow" autoFocus onFocus={function (event) { return event.target.select(); }} readOnly/>
            <components_1.Button variant="default" size="sm" onClick={onCopyClick}>
              Copy
            </components_1.Button>
          </div>
        </div>)}
    </components_1.Popup>);
};
exports.CreateApiKeyModal = CreateApiKeyModal;
