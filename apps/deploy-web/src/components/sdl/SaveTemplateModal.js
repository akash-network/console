"use strict";
"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveTemplateModal = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var router_1 = require("next/router");
var notistack_1 = require("notistack");
var zod_2 = require("zod");
var MustConnect_1 = require("@src/components/shared/MustConnect");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useShortText_1 = require("@src/hooks/useShortText");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var urlUtils_1 = require("@src/utils/urlUtils");
var formSchema = zod_2.z.object({
    title: zod_2.z.string().min(3, "Title must be at least 3 characters long"),
    visibility: zod_2.z.enum(["private", "public"])
});
var SaveTemplateModal = function (_a) {
    var onClose = _a.onClose, getTemplateData = _a.getTemplateData, templateMetadata = _a.templateMetadata, setTemplateMetadata = _a.setTemplateMetadata, services = _a.services;
    var _b = (0, react_1.useState)([]), publicEnvs = _b[0], setPublicEnvs = _b[1];
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var formRef = (0, react_1.useRef)(null);
    var _c = (0, useCustomUser_1.useCustomUser)(), user = _c.user, isLoadingUser = _c.isLoading;
    var isRestricted = !isLoadingUser && !user;
    var isCurrentUserTemplate = !isRestricted && (user === null || user === void 0 ? void 0 : user.sub) === (templateMetadata === null || templateMetadata === void 0 ? void 0 : templateMetadata.userId);
    var router = (0, router_1.useRouter)();
    var saveTemplate = (0, useTemplateQuery_1.useSaveUserTemplate)({
        onSuccess: function (template) {
            if (!isCurrentUserTemplate && template) {
                router.push(urlUtils_1.UrlService.sdlBuilder(template.id));
            }
        }
    }).mutate;
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            title: "",
            visibility: "private"
        },
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, setValue = form.setValue;
    (0, react_1.useEffect)(function () {
        var envs = services.some(function (s) { var _a; return (_a = s.env) === null || _a === void 0 ? void 0 : _a.some(function (e) { return !e.isSecret; }); })
            ? services.reduce(function (cur, prev) { var _a; return cur.concat(__spreadArray([], (_a = prev.env) === null || _a === void 0 ? void 0 : _a.filter(function (e) { return !e.isSecret; }), true)); }, [])
            : [];
        setPublicEnvs(envs);
        if (templateMetadata && isCurrentUserTemplate) {
            setValue("title", templateMetadata.title);
            setValue("visibility", templateMetadata.isPublic ? "public" : "private");
        }
    }, []);
    var onSubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var template, newTemplateMetadata;
        return __generator(this, function (_a) {
            template = getTemplateData();
            saveTemplate(__assign(__assign({}, template), { title: data.title, isPublic: data.visibility !== "private" }));
            newTemplateMetadata = __assign(__assign({}, templateMetadata), { title: data.title, isPublic: data.visibility !== "private" });
            if (!isCurrentUserTemplate) {
                newTemplateMetadata.username = user.username || "";
                newTemplateMetadata.userId = user.sub || "";
            }
            setTemplateMetadata(newTemplateMetadata);
            enqueueSnackbar(<components_1.Snackbar title="Template saved!" iconVariant="success"/>, {
                variant: "success"
            });
            if (newTemplateMetadata.id) {
                analytics_service_1.analyticsService.track("update_sdl_template", {
                    category: "sdl_builder",
                    label: "Update SDL template"
                });
            }
            else {
                analytics_service_1.analyticsService.track("create_sdl_template", {
                    category: "sdl_builder",
                    label: "Create SDL template"
                });
            }
            onClose();
            return [2 /*return*/];
        });
    }); };
    var onSave = function () {
        var _a;
        (_a = formRef.current) === null || _a === void 0 ? void 0 : _a.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };
    return (<components_1.Popup fullWidth open={true} variant="custom" title="Save Template" actions={[
            {
                label: "Cancel",
                color: "primary",
                variant: "text",
                side: "left",
                onClick: onClose
            },
            {
                label: isCurrentUserTemplate ? "Save" : "Save As",
                color: "secondary",
                variant: "default",
                side: "right",
                disabled: isRestricted,
                onClick: onSave
            }
        ]} onClose={onClose} maxWidth="xs" enableCloseOnBackdropClick>
      <div className="pt-2">
        {isRestricted ? (<MustConnect_1.MustConnect message="To save a template"/>) : (<components_1.Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
              <components_1.FormField control={control} name="title" render={function (_a) {
                var field = _a.field;
                return (<components_1.FormInput type="text" label="Title" className="mb-4 w-full" value={field.value || ""} onChange={function (event) { return field.onChange(event.target.value); }}/>);
            }}/>

              <components_1.FormField control={control} name={"visibility"} render={function (_a) {
                var field = _a.field;
                return (<components_1.RadioGroup defaultValue="private" value={field.value} onValueChange={field.onChange} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <components_1.RadioGroupItem value="private" id="private"/>
                      <components_1.Label htmlFor="private">Private</components_1.Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <components_1.RadioGroupItem value="public" id="public"/>
                      <components_1.Label htmlFor="public">Public</components_1.Label>
                    </div>
                  </components_1.RadioGroup>);
            }}/>

              {publicEnvs.length > 0 && (<components_1.Alert variant="warning" className="mt-4 max-h-[150px] overflow-y-auto">
                  You have {publicEnvs.length} public environment variables. Are you sure you don't need to hide them as secret?
                  <ul className="break-all p-0">
                    {publicEnvs.map(function (e, i) { return (<li key={i}>
                        {e.key}={(0, useShortText_1.getShortText)(e.value, 30)}
                      </li>); })}
                  </ul>
                </components_1.Alert>)}
            </form>
          </components_1.Form>)}
      </div>
    </components_1.Popup>);
};
exports.SaveTemplateModal = SaveTemplateModal;
