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
exports.RentGpusForm = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var web_1 = require("@akashnetwork/chain-sdk/web");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var navigation_1 = require("next/navigation");
var CertificateProvider_1 = require("@src/context/CertificateProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useManagedWalletDenom_1 = require("@src/hooks/useManagedWalletDenom");
var useWhen_1 = require("@src/hooks/useWhen");
var useGpuQuery_1 = require("@src/queries/useGpuQuery");
var useSaveSettings_1 = require("@src/queries/useSaveSettings");
var sdlStore_1 = require("@src/store/sdlStore");
var types_1 = require("@src/types");
var route_steps_type_1 = require("@src/types/route-steps.type");
var deploymentData_1 = require("@src/utils/deploymentData");
var deploymentUtils_1 = require("@src/utils/deploymentUtils");
var data_1 = require("@src/utils/sdl/data");
var sdlGenerator_1 = require("@src/utils/sdl/sdlGenerator");
var sdlImport_1 = require("@src/utils/sdl/sdlImport");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var urlUtils_1 = require("@src/utils/urlUtils");
var walletUtils_1 = require("@src/utils/walletUtils");
var DeploymentDepositModal_1 = require("../deployments/DeploymentDepositModal");
var LinkTo_1 = require("../shared/LinkTo");
var PrerequisiteList_1 = require("../shared/PrerequisiteList");
var AdvancedConfig_1 = require("./AdvancedConfig");
var CpuFormControl_1 = require("./CpuFormControl");
var DeploymentMinimumEscrowAlertText_1 = require("./DeploymentMinimumEscrowAlertText");
var EphemeralStorageFormControl_1 = require("./EphemeralStorageFormControl");
var FormPaper_1 = require("./FormPaper");
var GpuFormControl_1 = require("./GpuFormControl");
var ImageSelect_1 = require("./ImageSelect");
var MemoryFormControl_1 = require("./MemoryFormControl");
var RegionSelect_1 = require("./RegionSelect");
var TokenFormControl_1 = require("./TokenFormControl");
var RentGpusForm = function () {
    var _a, _b, _c;
    var _d = (0, ServicesProvider_1.useServices)(), chainApiHttpClient = _d.chainApiHttpClient, analyticsService = _d.analyticsService, appConfig = _d.appConfig, deploymentLocalStorage = _d.deploymentLocalStorage;
    var _e = (0, react_1.useState)(null), error = _e[0], setError = _e[1];
    // const [templateMetadata, setTemplateMetadata] = useState<ITemplate>(null);
    var _f = (0, react_1.useState)(false), isQueryInit = _f[0], setIsQuertInit = _f[1];
    var _g = (0, react_1.useState)(false), isCreatingDeployment = _g[0], setIsCreatingDeployment = _g[1];
    var _h = (0, react_1.useState)(false), isDepositingDeployment = _h[0], setIsDepositingDeployment = _h[1];
    var _j = (0, react_1.useState)(false), isCheckingPrerequisites = _j[0], setIsCheckingPrerequisites = _j[1];
    var formRef = (0, react_1.useRef)(null);
    var _k = (0, jotai_1.useAtom)(sdlStore_1.default.deploySdl), setDeploySdl = _k[1];
    var _l = (0, jotai_1.useAtom)(sdlStore_1.default.rentGpuSdl), rentGpuSdl = _l[0], setRentGpuSdl = _l[1];
    var gpuModels = (0, useGpuQuery_1.useGpuModels)().data;
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            services: [__assign({}, data_1.defaultRentGpuService)],
            region: __assign({}, data_1.defaultAnyRegion)
        },
        resolver: (0, zod_1.zodResolver)(types_1.RentGpusFormValuesSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, watch = form.watch, setValue = form.setValue, trigger = form.trigger;
    var _services = watch().services;
    var searchParams = (0, navigation_1.useSearchParams)();
    var currentService = (_services && _services[0]) || {};
    var _m = (0, WalletProvider_1.useWallet)(), address = _m.address, signAndBroadcastTx = _m.signAndBroadcastTx, isManaged = _m.isManaged;
    var _o = (0, CertificateProvider_1.useCertificate)(), loadValidCertificates = _o.loadValidCertificates, localCert = _o.localCert, isLocalCertMatching = _o.isLocalCertMatching, loadLocalCert = _o.loadLocalCert, setSelectedCertificate = _o.setSelectedCertificate;
    var _p = (0, react_1.useState)("uakt"), sdlDenom = _p[0], setSdlDenom = _p[1];
    var router = (0, navigation_1.useRouter)();
    var managedDenom = (0, useManagedWalletDenom_1.useManagedWalletDenom)();
    var depositParams = (0, useSaveSettings_1.useDepositParams)().data;
    var defaultDeposit = depositParams || appConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT;
    (0, useWhen_1.useWhen)(isManaged && sdlDenom === "uakt", function () {
        setSdlDenom(managedDenom);
        setValue("services.0.placement.pricing.denom", managedDenom);
    });
    (0, react_1.useEffect)(function () {
        if (rentGpuSdl && rentGpuSdl.services) {
            setValue("services", structuredClone(rentGpuSdl.services));
            setValue("region", rentGpuSdl.region || __assign({}, data_1.defaultAnyRegion));
            // Set the value of gpu models specifically because nested value doesn't re-render correctly
            // https://github.com/react-hook-form/react-hook-form/issues/7758
            setValue("services.0.profile.gpuModels", rentGpuSdl.services[0].profile.gpuModels || []);
        }
        var subscription = watch(function (_a) {
            var services = _a.services, region = _a.region;
            setRentGpuSdl({ services: services, region: region });
        });
        return function () { return subscription.unsubscribe(); };
    }, []);
    (0, react_1.useEffect)(function () {
        var _a;
        var vendorQuery = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("vendor");
        var gpuQuery = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("gpu");
        if (vendorQuery && gpuQuery && gpuModels && !isQueryInit) {
            // Example query: ?vendor=nvidia&gpu=h100&vram=80Gi&interface=sxm
            var gpuModel = (_a = gpuModels.find(function (x) { return x.name === vendorQuery; })) === null || _a === void 0 ? void 0 : _a.models.find(function (x) { return x.name === gpuQuery; });
            if (gpuModel) {
                var vramQuery_1 = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("vram");
                var interfaceQuery_1 = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("interface");
                var model = {
                    vendor: vendorQuery,
                    name: gpuModel.name,
                    memory: gpuModel.memory.find(function (x) { return x === vramQuery_1; }) || "",
                    interface: gpuModel.interface.find(function (x) { return x === interfaceQuery_1; }) || ""
                };
                setValue("services.0.profile.gpuModels", [model]);
            }
            else {
                console.log("GPU model not found", gpuQuery);
            }
            setIsQuertInit(true);
        }
    }, [searchParams, gpuModels, isQueryInit]);
    function createAndValidateDeploymentData(yamlStr_1) {
        return __awaiter(this, arguments, void 0, function (yamlStr, dseq, deposit) {
            var dd, err_1;
            if (dseq === void 0) { dseq = null; }
            if (deposit === void 0) { deposit = defaultDeposit; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!yamlStr)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, deploymentData_1.deploymentData.NewDeploymentData(chainApiHttpClient, yamlStr, dseq, address, deposit)];
                    case 1:
                        dd = _a.sent();
                        (0, deploymentUtils_1.validateDeploymentData)(dd);
                        setSdlDenom(dd.deposit.denom);
                        return [2 /*return*/, dd];
                    case 2:
                        err_1 = _a.sent();
                        console.error(err_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    var createAndValidateSdl = function (yamlStr) {
        try {
            if (!yamlStr)
                return null;
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
                // setParsingError(err.message);
                console.error(err);
            }
        }
    };
    var onSelectTemplate = function (template) {
        var _a;
        var result = createAndValidateSdl(template === null || template === void 0 ? void 0 : template.deploy);
        if (!result)
            return;
        // Filter out invalid gpu models
        var _gpuModels = ((result && ((_a = result[0].profile) === null || _a === void 0 ? void 0 : _a.gpuModels)) || []).map(function (templateModel) {
            var _a;
            var isValid = (_a = gpuModels === null || gpuModels === void 0 ? void 0 : gpuModels.find(function (x) { return x.name === templateModel.vendor; })) === null || _a === void 0 ? void 0 : _a.models.some(function (x) { return x.name === templateModel.name; });
            return {
                vendor: isValid ? templateModel.vendor : "nvidia",
                name: isValid ? templateModel.name : "",
                memory: isValid ? templateModel.memory : "",
                interface: isValid ? templateModel.interface : ""
            };
        });
        setValue("services", result);
        setValue("services.0.profile.gpuModels", _gpuModels);
        setValue("services.0.placement.pricing.denom", managedDenom);
        trigger();
    };
    var onPrerequisiteContinue = function () {
        setIsCheckingPrerequisites(false);
        setIsDepositingDeployment(true);
    };
    var onDeploymentDeposit = function (deposit) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsDepositingDeployment(false);
                    return [4 /*yield*/, handleCreateClick(deposit)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var onSubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setRentGpuSdl(data);
            if (isManaged) {
                setIsDepositingDeployment(true);
            }
            else {
                setIsCheckingPrerequisites(true);
            }
            return [2 /*return*/];
        });
    }); };
    function handleCreateClick(deposit) {
        return __awaiter(this, void 0, void 0, function () {
            var sdl, dd, validCertificates, currentCert, isCertificateValidated, isLocalCertificateValidated, messages, hasValidCert, _crtpem_1, _encryptedKey_1, _a, crtpem, pubpem, encryptedKey, response, validCerts, currentCert_1, error_1;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        setError(null);
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 11, , 12]);
                        if (!rentGpuSdl)
                            return [2 /*return*/];
                        sdl = (0, sdlGenerator_1.generateSdl)(rentGpuSdl.services, (_b = rentGpuSdl.region) === null || _b === void 0 ? void 0 : _b.key);
                        setIsCreatingDeployment(true);
                        return [4 /*yield*/, createAndValidateDeploymentData(sdl, null, deposit)];
                    case 2:
                        dd = _d.sent();
                        return [4 /*yield*/, loadValidCertificates()];
                    case 3:
                        validCertificates = _d.sent();
                        currentCert = validCertificates.find(function (x) { return x.parsed === (localCert === null || localCert === void 0 ? void 0 : localCert.certPem); });
                        isCertificateValidated = ((_c = currentCert === null || currentCert === void 0 ? void 0 : currentCert.certificate) === null || _c === void 0 ? void 0 : _c.state) === "valid";
                        isLocalCertificateValidated = !!localCert && isLocalCertMatching;
                        if (!dd)
                            return [2 /*return*/];
                        messages = [];
                        hasValidCert = isCertificateValidated && isLocalCertificateValidated;
                        if (!!hasValidCert) return [3 /*break*/, 5];
                        return [4 /*yield*/, web_1.certificateManager.generatePEM(address)];
                    case 4:
                        _a = _d.sent(), crtpem = _a.cert, pubpem = _a.publicKey, encryptedKey = _a.privateKey;
                        _crtpem_1 = crtpem;
                        _encryptedKey_1 = encryptedKey;
                        messages.push(TransactionMessageData_1.TransactionMessageData.getCreateCertificateMsg(address, crtpem, pubpem));
                        _d.label = 5;
                    case 5:
                        messages.push(TransactionMessageData_1.TransactionMessageData.getCreateDeploymentMsg(dd));
                        return [4 /*yield*/, signAndBroadcastTx(messages)];
                    case 6:
                        response = _d.sent();
                        if (!response) return [3 /*break*/, 9];
                        if (!!hasValidCert) return [3 /*break*/, 8];
                        (0, walletUtils_1.updateWallet)(address, function (wallet) {
                            return __assign(__assign({}, wallet), { cert: _crtpem_1, certKey: _encryptedKey_1 });
                        });
                        return [4 /*yield*/, loadValidCertificates()];
                    case 7:
                        validCerts = _d.sent();
                        loadLocalCert();
                        currentCert_1 = validCerts.find(function (x) { return x.parsed === _crtpem_1; }) || null;
                        setSelectedCertificate(currentCert_1);
                        _d.label = 8;
                    case 8:
                        setDeploySdl(null);
                        deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
                            manifest: sdl,
                            manifestVersion: dd.hash,
                            name: currentService.image
                        });
                        router.push(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.createLeases, dseq: dd.deploymentId.dseq }));
                        analyticsService.track("create_gpu_deployment", {
                            category: "deployments",
                            label: "Create deployment rent gpu form"
                        });
                        return [3 /*break*/, 10];
                    case 9:
                        setIsCreatingDeployment(false);
                        _d.label = 10;
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        error_1 = _d.sent();
                        setIsCreatingDeployment(false);
                        setError(error_1.message);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    }
    var serviceIndex = 0;
    var _q = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".profile.storage"),
        keyName: "id"
    }), appendStorage = _q.append, removeStorage = _q.remove, storages = _q.fields;
    return (<>
      {isDepositingDeployment && (<DeploymentDepositModal_1.DeploymentDepositModal handleCancel={function () { return setIsDepositingDeployment(false); }} onDeploymentDeposit={onDeploymentDeposit} denom={((_b = (_a = currentService === null || currentService === void 0 ? void 0 : currentService.placement) === null || _a === void 0 ? void 0 : _a.pricing) === null || _b === void 0 ? void 0 : _b.denom) || sdlDenom} infoText={<components_1.Alert className="mb-4" variant="default">
              <p className="text-sm text-muted-foreground">
                <DeploymentMinimumEscrowAlertText_1.DeploymentMinimumEscrowAlertText />
                <LinkTo_1.LinkTo onClick={function (ev) { return (0, urlUtils_1.handleDocClick)(ev, "https://akash.network/docs/getting-started/intro-to-akash/bids-and-leases/#escrow-accounts"); }}>
                  <strong>Learn more.</strong>
                </LinkTo_1.LinkTo>
              </p>
            </components_1.Alert>} title="Confirm deployment creation?" services={rentGpuSdl === null || rentGpuSdl === void 0 ? void 0 : rentGpuSdl.services}/>)}
      {isCheckingPrerequisites && <PrerequisiteList_1.PrerequisiteList onClose={function () { return setIsCheckingPrerequisites(false); }} onContinue={onPrerequisiteContinue}/>}

      <components_1.Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
          <FormPaper_1.FormPaper className="mt-4 md:p-4">
            <ImageSelect_1.ImageSelect control={control} currentService={currentService} onSelectTemplate={onSelectTemplate}/>

            <div className="mt-4">
              <GpuFormControl_1.GpuFormControl control={control} gpuModels={gpuModels} serviceIndex={0} hasGpu currentService={currentService} setValue={setValue} hideHasGpu/>
            </div>

            <div className="mt-4">
              <CpuFormControl_1.CpuFormControl control={control} currentService={currentService} serviceIndex={0}/>
            </div>

            <div className="mt-4">
              <MemoryFormControl_1.MemoryFormControl control={control} serviceIndex={0}/>
            </div>

            <div className="mt-4">
              <EphemeralStorageFormControl_1.EphemeralStorageFormControl services={_services} control={control} serviceIndex={0} appendStorage={appendStorage}/>
            </div>

            <div className="grid-col-2 mt-4 grid gap-2">
              <div>
                <RegionSelect_1.RegionSelect control={control}/>
              </div>
              {!isManaged && (<div>
                  <TokenFormControl_1.TokenFormControl control={control} name="services.0.placement.pricing.denom"/>
                </div>)}
            </div>
          </FormPaper_1.FormPaper>

          <AdvancedConfig_1.AdvancedConfig control={control} currentService={currentService} storages={storages} setValue={setValue} appendStorage={appendStorage} removeStorage={removeStorage}/>

          {error && (<components_1.Alert variant="destructive" className="mt-4">
              {error}
            </components_1.Alert>)}

          {((_c = currentService === null || currentService === void 0 ? void 0 : currentService.env) === null || _c === void 0 ? void 0 : _c.some(function (x) { return !!x.key && !x.value; })) && (<components_1.Alert variant="warning" className="mt-4">
              Some of the environment variables are empty. Please fill them in the advanced configuration before deploying.
            </components_1.Alert>)}

          <div className="flex items-center justify-end pt-4">
            <components_1.Button size="lg" variant="default" type="submit" disabled={isCreatingDeployment || !!error}>
              {isCreatingDeployment ? (<components_1.Spinner />) : (<>
                  Deploy{" "}
                  <span className="ml-2 inline-flex items-center">
                    <iconoir_react_1.Rocket className="rotate-45 text-sm"/>
                  </span>
                </>)}
            </components_1.Button>
          </div>
        </form>
      </components_1.Form>
    </>);
};
exports.RentGpusForm = RentGpusForm;
