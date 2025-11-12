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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleSDLBuilderForm = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var notistack_1 = require("notistack");
var SimpleServiceFormControl_1 = require("@src/components/sdl/SimpleServiceFormControl");
var deploy_config_1 = require("@src/config/deploy.config");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useFormPersist_1 = require("@src/hooks/useFormPersist");
var useSdlServiceManager_1 = require("@src/hooks/useSdlServiceManager/useSdlServiceManager");
var useGpuQuery_1 = require("@src/queries/useGpuQuery");
var sdlStore_1 = require("@src/store/sdlStore");
var types_1 = require("@src/types");
var route_steps_type_1 = require("@src/types/route-steps.type");
var units_1 = require("@src/utils/akash/units");
var data_1 = require("@src/utils/sdl/data");
var sdlGenerator_1 = require("@src/utils/sdl/sdlGenerator");
var sdlImport_1 = require("@src/utils/sdl/sdlImport");
var urlUtils_1 = require("@src/utils/urlUtils");
var ImportSdlModal_1 = require("./ImportSdlModal");
var PreviewSdl_1 = require("./PreviewSdl");
var SaveTemplateModal_1 = require("./SaveTemplateModal");
var DEFAULT_SERVICES = {
    services: [__assign({}, data_1.defaultService)]
};
var SimpleSDLBuilderForm = function () {
    var _a = (0, ServicesProvider_1.useServices)(), consoleApiHttpClient = _a.consoleApiHttpClient, analyticsService = _a.analyticsService;
    var _b = (0, react_1.useState)(null), error = _b[0], setError = _b[1];
    var _c = (0, react_1.useState)(null), templateMetadata = _c[0], setTemplateMetadata = _c[1];
    var _d = (0, react_1.useState)([]), serviceCollapsed = _d[0], setServiceCollapsed = _d[1];
    var _e = (0, react_1.useState)(false), isLoadingTemplate = _e[0], setIsLoadingTemplate = _e[1];
    var _f = (0, react_1.useState)(false), isSavingTemplate = _f[0], setIsSavingTemplate = _f[1];
    var _g = (0, react_1.useState)(false), isImportingSdl = _g[0], setIsImportingSdl = _g[1];
    var _h = (0, react_1.useState)(false), isPreviewingSdl = _h[0], setIsPreviewingSdl = _h[1];
    var _j = (0, react_1.useState)(null), sdlResult = _j[0], setSdlResult = _j[1];
    var formRef = (0, react_1.useRef)(null);
    var _k = (0, jotai_1.useAtom)(sdlStore_1.default.deploySdl), setDeploySdl = _k[1];
    var _l = (0, jotai_1.useAtom)(sdlStore_1.default.sdlBuilderSdl), sdlBuilderSdl = _l[0], setSdlBuilderSdl = _l[1];
    var gpuModels = (0, useGpuQuery_1.useGpuModels)().data;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var form = (0, react_hook_form_1.useForm)({
        resolver: (0, zod_1.zodResolver)(types_1.SdlBuilderFormValuesSchema)
    });
    var handleSubmit = form.handleSubmit, reset = form.reset, control = form.control, trigger = form.trigger, watch = form.watch, setValue = form.setValue;
    (0, useFormPersist_1.default)("sdl-builder-form", {
        watch: watch,
        setValue: setValue,
        defaultValues: DEFAULT_SERVICES,
        storage: typeof window === "undefined" ? undefined : window.localStorage
    });
    var _services = watch().services;
    var serviceManager = (0, useSdlServiceManager_1.useSdlServiceManager)({ control: control });
    var router = (0, navigation_1.useRouter)();
    var searchParams = (0, navigation_1.useSearchParams)();
    var templateQueryId = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("id");
    (0, react_1.useEffect)(function () {
        if (sdlBuilderSdl && sdlBuilderSdl.services) {
            setValue("services", sdlBuilderSdl.services);
        }
    }, []);
    // Load the template from query string on mount
    (0, react_1.useEffect)(function () {
        if ((templateQueryId && !templateMetadata) || (templateQueryId && (templateMetadata === null || templateMetadata === void 0 ? void 0 : templateMetadata.id) !== templateQueryId)) {
            // Load user template
            loadTemplate(templateQueryId);
        }
        else if (!templateQueryId && templateMetadata) {
            setTemplateMetadata(null);
            reset();
        }
    }, [templateQueryId, templateMetadata]);
    (0, react_1.useEffect)(function () {
        if (_services) {
            setSdlBuilderSdl({ services: _services });
        }
    }, [_services]);
    var loadTemplate = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        var response, template, services, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    setIsLoadingTemplate(true);
                    return [4 /*yield*/, consoleApiHttpClient.get("/user/template/".concat(id))];
                case 1:
                    response = _a.sent();
                    template = response.data;
                    services = (0, sdlImport_1.importSimpleSdl)(template.sdl);
                    setIsLoadingTemplate(false);
                    reset();
                    setValue("services", services);
                    setServiceCollapsed(services.map(function (x, i) { return i; }));
                    setTemplateMetadata(template);
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    enqueueSnackbar(<components_1.Snackbar title="Error fetching template." iconVariant="error"/>, {
                        variant: "error"
                    });
                    setIsLoadingTemplate(false);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var onSubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var sdl;
        return __generator(this, function (_a) {
            setError(null);
            try {
                sdl = (0, sdlGenerator_1.generateSdl)(data.services);
                setDeploySdl({
                    title: "",
                    category: "",
                    code: deploy_config_1.USER_TEMPLATE_CODE,
                    description: "",
                    content: sdl
                });
                router.push(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment }));
                analyticsService.track("deploy_sdl", {
                    category: "sdl_builder",
                    label: "Deploy SDL from create page"
                });
            }
            catch (error) {
                setError(error.message);
            }
            return [2 /*return*/];
        });
    }); };
    var onSaveClick = function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, trigger()];
                case 1:
                    result = _a.sent();
                    if (result) {
                        setIsSavingTemplate(true);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var onPreviewSdlClick = function () {
        setError(null);
        try {
            var sdl = (0, sdlGenerator_1.generateSdl)(_services);
            setSdlResult(sdl);
            setIsPreviewingSdl(true);
            analyticsService.track("preview_sdl", {
                category: "sdl_builder",
                label: "Preview SDL from create page"
            });
        }
        catch (error) {
            setError(error.message);
        }
    };
    var getTemplateData = function () {
        var sdl = (0, sdlGenerator_1.generateSdl)(_services);
        var template = {
            id: (templateMetadata === null || templateMetadata === void 0 ? void 0 : templateMetadata.id) || undefined,
            sdl: sdl,
            cpu: _services === null || _services === void 0 ? void 0 : _services.map(function (s) { var _a; return (((_a = s.profile) === null || _a === void 0 ? void 0 : _a.cpu) || 0) * 1000; }).reduce(function (a, b) { return a + b; }, 0),
            ram: _services === null || _services === void 0 ? void 0 : _services.map(function (s) {
                var _a;
                var ramUnit = units_1.memoryUnits.find(function (x) { var _a; return x.suffix === ((_a = s.profile) === null || _a === void 0 ? void 0 : _a.ramUnit); });
                return (((_a = s.profile) === null || _a === void 0 ? void 0 : _a.ram) || 0) * ((ramUnit === null || ramUnit === void 0 ? void 0 : ramUnit.value) || 0);
            }).reduce(function (a, b) { return a + b; }, 0),
            storage: _services === null || _services === void 0 ? void 0 : _services.map(function (s) {
                var _a;
                return (_a = s.profile) === null || _a === void 0 ? void 0 : _a.storage.reduce(function (memo, storage) {
                    var storageUnit = units_1.storageUnits.find(function (x) { return x.suffix === storage.unit; });
                    return memo + (storage.size || 0) * ((storageUnit === null || storageUnit === void 0 ? void 0 : storageUnit.value) || 0);
                }, 0);
            }).reduce(function (a, b) { return a + b; }, 0)
        };
        return template;
    };
    return (<>
      {isImportingSdl && <ImportSdlModal_1.ImportSdlModal onClose={function () { return setIsImportingSdl(false); }} setValue={setValue}/>}
      {isPreviewingSdl && <PreviewSdl_1.PreviewSdl onClose={function () { return setIsPreviewingSdl(false); }} sdl={sdlResult || ""}/>}
      {isSavingTemplate && (<SaveTemplateModal_1.SaveTemplateModal onClose={function () { return setIsSavingTemplate(false); }} getTemplateData={getTemplateData} templateMetadata={templateMetadata} setTemplateMetadata={setTemplateMetadata} services={_services}/>)}

      <components_1.Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
          {templateMetadata && (<div className="flex items-center">
              <p>
                {templateMetadata.title}&nbsp;by&nbsp;
                {templateMetadata.username && (<span onClick={function () {
                    analyticsService.track("click_sdl_profile", {
                        category: "sdl_builder",
                        label: "Click on SDL user profile"
                    });
                }}>
                    <link_1.default href={urlUtils_1.UrlService.userProfile(templateMetadata.username)}>{templateMetadata.username}</link_1.default>
                  </span>)}
              </p>

              <div className="ml-6">
                <link_1.default href={urlUtils_1.UrlService.template(templateQueryId)} className="inline-flex cursor-pointer items-center" onClick={function () {
                analyticsService.track("click_view_template", {
                    category: "sdl_builder",
                    label: "Click on view SDL template"
                });
            }}>
                  View template <iconoir_react_1.NavArrowRight className="ml-2 text-sm"/>
                </link_1.default>
              </div>
            </div>)}

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center">
              <components_1.Button color="secondary" variant="default" type="submit">
                Deploy
              </components_1.Button>

              <components_1.Button color="secondary" variant="text" onClick={onPreviewSdlClick} className="ml-4" type="button">
                Preview
              </components_1.Button>

              <components_1.Button color="secondary" variant="text" onClick={function () { return setIsImportingSdl(true); }} className="ml-4" type="button">
                Import
              </components_1.Button>

              <components_1.Button variant="text" className="ml-4" type="button" onClick={function () {
            analyticsService.track("reset_sdl", {
                category: "sdl_builder",
                label: "Reset SDL"
            });
            setValue("services", [__assign({}, data_1.defaultService)]);
        }}>
                Reset
              </components_1.Button>

              {isLoadingTemplate && (<div className="ml-4">
                  <components_1.Spinner size="small"/>
                </div>)}
            </div>

            <div>
              <components_1.Button color="secondary" variant="default" type="button" onClick={function () { return onSaveClick(); }}>
                Save
              </components_1.Button>
            </div>
          </div>

          {_services === null || _services === void 0 ? void 0 : _services.map(function (service, serviceIndex) { return (<SimpleServiceFormControl_1.SimpleServiceFormControl key={service.id} serviceIndex={serviceIndex} _services={_services} setValue={setValue} control={control} trigger={trigger} onRemoveService={serviceManager.remove} serviceCollapsed={serviceCollapsed} setServiceCollapsed={setServiceCollapsed} gpuModels={gpuModels}/>); })}

          {error && (<components_1.Alert variant="destructive" className="mt-4">
              {error}
            </components_1.Alert>)}

          <div className="flex items-center justify-end pt-4">
            <div>
              <components_1.Button color="secondary" variant="default" onClick={serviceManager.add} type="button">
                Add Service
              </components_1.Button>
            </div>
          </div>
        </form>
      </components_1.Form>
    </>);
};
exports.SimpleSDLBuilderForm = SimpleSDLBuilderForm;
