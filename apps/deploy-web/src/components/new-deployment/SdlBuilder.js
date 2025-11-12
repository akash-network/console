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
exports.SdlBuilder = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var cloneDeep_1 = require("lodash/cloneDeep");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider/SdlBuilderProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useManagedWalletDenom_1 = require("@src/hooks/useManagedWalletDenom");
var useSdlServiceManager_1 = require("@src/hooks/useSdlServiceManager/useSdlServiceManager");
var useWhen_1 = require("@src/hooks/useWhen");
var useGpuQuery_1 = require("@src/queries/useGpuQuery");
var types_1 = require("@src/types");
var data_1 = require("@src/utils/sdl/data");
var sdlGenerator_1 = require("@src/utils/sdl/sdlGenerator");
var sdlImport_1 = require("@src/utils/sdl/sdlImport");
var transformCustomSdlFields_1 = require("@src/utils/sdl/transformCustomSdlFields");
var RemoteRepositoryDeployManager_1 = require("../remote-deploy/RemoteRepositoryDeployManager");
var SimpleServiceFormControl_1 = require("../sdl/SimpleServiceFormControl");
exports.SdlBuilder = react_1.default.forwardRef(function (_a, ref) {
    var sdlString = _a.sdlString, setEditedManifest = _a.setEditedManifest, isGitProviderTemplate = _a.isGitProviderTemplate, setDeploymentName = _a.setDeploymentName, deploymentName = _a.deploymentName, setIsRepoInputValid = _a.setIsRepoInputValid;
    var _b = (0, react_1.useState)(null), error = _b[0], setError = _b[1];
    var formRef = (0, react_1.useRef)(null);
    var _c = (0, react_1.useState)(false), isInit = _c[0], setIsInit = _c[1];
    var _d = (0, SdlBuilderProvider_1.useSdlBuilder)(), hasComponent = _d.hasComponent, imageList = _d.imageList;
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            services: [(0, cloneDeep_1.default)(hasComponent("ssh") ? data_1.defaultSshVMService : data_1.defaultService)],
            imageList: imageList,
            hasSSHKey: hasComponent("ssh")
        },
        resolver: (0, zod_1.zodResolver)(types_1.SdlBuilderFormValuesSchema)
    });
    var control = form.control, trigger = form.trigger, watch = form.watch, setValue = form.setValue;
    var serviceManager = (0, useSdlServiceManager_1.useSdlServiceManager)({ control: control });
    var _e = watch().services, formServices = _e === void 0 ? [] : _e;
    var gpuModels = (0, useGpuQuery_1.useGpuModels)().data;
    var _f = (0, react_1.useState)(isGitProviderTemplate ? [0] : []), serviceCollapsed = _f[0], setServiceCollapsed = _f[1];
    var wallet = (0, WalletProvider_1.useWallet)();
    var managedDenom = (0, useManagedWalletDenom_1.useManagedWalletDenom)();
    (0, useWhen_1.useWhen)(wallet.isManaged, function () {
        formServices.forEach(function (service, index) {
            var denom = service.placement.pricing.denom;
            if (denom !== managedDenom) {
                setValue("services.".concat(index, ".placement.pricing.denom"), managedDenom);
            }
        });
    }, [formServices, sdlString]);
    react_1.default.useImperativeHandle(ref, function () { return ({
        getSdl: getSdl,
        validate: function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, trigger()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); }
    }); });
    (0, react_1.useEffect)(function () {
        var unsubscribe = watch(function (data) {
            var sdl = (0, sdlGenerator_1.generateSdl)(data.services);
            setEditedManifest(sdl);
        }).unsubscribe;
        try {
            if (sdlString) {
                var services = createAndValidateSdl(sdlString);
                setValue("services", services);
            }
        }
        catch (error) {
            setError("Error importing SDL");
        }
        setIsInit(true);
        return function () {
            unsubscribe();
        };
    }, [watch]);
    var getSdl = function () {
        try {
            return (0, sdlGenerator_1.generateSdl)((0, transformCustomSdlFields_1.transformCustomSdlFields)(formServices, { withSSH: hasComponent("ssh") }));
        }
        catch (err) {
            if (err instanceof transformCustomSdlFields_1.TransformError) {
                setError(err.message);
            }
        }
    };
    var createAndValidateSdl = function (yamlStr) {
        try {
            if (!yamlStr)
                return [];
            var services = (0, sdlImport_1.importSimpleSdl)(yamlStr);
            setError(null);
            return services;
        }
        catch (err) {
            if (err.name === "YAMLException" || err.name === "CustomValidationError") {
                setError(err.message);
            }
            else if (err.name === "TemplateValidation") {
                setError(err.message);
            }
            else {
                setError("Error while parsing SDL file");
            }
        }
    };
    return (<div className="pb-8">
        {!isInit ? (<div className="flex items-center justify-center p-8">
            <components_1.Spinner size="large"/>
          </div>) : (<>
            {isGitProviderTemplate && (<RemoteRepositoryDeployManager_1.default setValue={setValue} services={formServices} control={control} setDeploymentName={setDeploymentName} deploymentName={deploymentName} setIsRepoInputValid={setIsRepoInputValid}/>)}
            <components_1.Form {...form}>
              <form ref={formRef} autoComplete="off">
                {formServices &&
                formServices.map(function (service, serviceIndex) { return (<SimpleServiceFormControl_1.SimpleServiceFormControl key={service.id} serviceIndex={serviceIndex} gpuModels={gpuModels} setValue={setValue} _services={formServices} control={control} trigger={trigger} onRemoveService={serviceManager.remove} serviceCollapsed={serviceCollapsed} setServiceCollapsed={setServiceCollapsed} hasSecretOption={false} isGitProviderTemplate={isGitProviderTemplate}/>); })}

                {error && (<components_1.Alert variant="destructive" className="mt-4">
                    {error}
                  </components_1.Alert>)}

                {!hasComponent("ssh") && !isGitProviderTemplate && (<div className="flex items-center justify-end pt-4">
                    <div>
                      <components_1.Button variant="default" size="sm" type="button" onClick={serviceManager.add}>
                        Add Service
                      </components_1.Button>
                    </div>
                  </div>)}
              </form>
            </components_1.Form>
          </>)}
      </div>);
});
