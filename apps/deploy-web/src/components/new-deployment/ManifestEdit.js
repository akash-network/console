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
exports.ManifestEdit = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var styles_1 = require("@mui/material/styles");
var useMediaQuery_1 = require("@mui/material/useMediaQuery");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var notistack_1 = require("notistack");
var CertificateProvider_1 = require("@src/context/CertificateProvider");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider/SdlBuilderProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var useImportSimpleSdl_1 = require("@src/hooks/useImportSimpleSdl");
var useManagedWalletDenom_1 = require("@src/hooks/useManagedWalletDenom");
var useWhen_1 = require("@src/hooks/useWhen");
var useDeploymentQuery_1 = require("@src/queries/useDeploymentQuery");
var useSaveSettings_1 = require("@src/queries/useSaveSettings");
var sdlStore_1 = require("@src/store/sdlStore");
var route_steps_type_1 = require("@src/types/route-steps.type");
var deploymentData_1 = require("@src/utils/deploymentData");
var v1beta3_1 = require("@src/utils/deploymentData/v1beta3");
var deploymentUtils_1 = require("@src/utils/deploymentUtils");
var timer_1 = require("@src/utils/timer");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var urlUtils_1 = require("@src/utils/urlUtils");
var SettingsProvider_1 = require("../../context/SettingsProvider");
var SignUpButton_1 = require("../auth/SignUpButton/SignUpButton");
var DeploymentDepositModal_1 = require("../deployments/DeploymentDepositModal");
var DeploymentMinimumEscrowAlertText_1 = require("../sdl/DeploymentMinimumEscrowAlertText");
var shared_1 = require("../shared");
var CustomNextSeo_1 = require("../shared/CustomNextSeo");
var DynamicMonacoEditor_1 = require("../shared/DynamicMonacoEditor");
var LinkTo_1 = require("../shared/LinkTo");
var PrerequisiteList_1 = require("../shared/PrerequisiteList");
var ViewPanel_1 = require("../shared/ViewPanel");
var SdlBuilder_1 = require("./SdlBuilder");
var TRIAL_DEPLOYMENT_LIMIT = 5;
var ManifestEdit = function (_a) {
    var _b;
    var editedManifest = _a.editedManifest, setEditedManifest = _a.setEditedManifest, onTemplateSelected = _a.onTemplateSelected, selectedTemplate = _a.selectedTemplate, isGitProviderTemplate = _a.isGitProviderTemplate;
    var _c = (0, react_1.useState)(null), parsingError = _c[0], setParsingError = _c[1];
    var _d = (0, react_1.useState)(""), deploymentName = _d[0], setDeploymentName = _d[1];
    var _e = (0, react_1.useState)(false), isCreatingDeployment = _e[0], setIsCreatingDeployment = _e[1];
    var _f = (0, react_1.useState)(false), isDepositingDeployment = _f[0], setIsDepositingDeployment = _f[1];
    var _g = (0, react_1.useState)(false), isCheckingPrerequisites = _g[0], setIsCheckingPrerequisites = _g[1];
    var _h = (0, jotai_1.useAtom)(sdlStore_1.default.selectedSdlEditMode), selectedSdlEditMode = _h[0], setSelectedSdlEditMode = _h[1];
    var _j = (0, react_1.useState)(false), isRepoInputValid = _j[0], setIsRepoInputValid = _j[1];
    var _k = (0, react_1.useState)("uakt"), sdlDenom = _k[0], setSdlDenom = _k[1];
    var isAnonymousFreeTrialEnabled = (0, useFlag_1.useFlag)("anonymous_free_trial");
    var _l = (0, ServicesProvider_1.useServices)(), analyticsService = _l.analyticsService, chainApiHttpClient = _l.chainApiHttpClient, appConfig = _l.appConfig, deploymentLocalStorage = _l.deploymentLocalStorage;
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var _m = (0, WalletProvider_1.useWallet)(), address = _m.address, signAndBroadcastTx = _m.signAndBroadcastTx, isManaged = _m.isManaged, isTrialing = _m.isTrialing, isOnboarding = _m.isOnboarding;
    var router = (0, navigation_1.useRouter)();
    var _o = (0, CertificateProvider_1.useCertificate)(), updateSelectedCertificate = _o.updateSelectedCertificate, genNewCertificateIfLocalIsInvalid = _o.genNewCertificateIfLocalIsInvalid;
    var _p = (0, jotai_1.useAtom)(sdlStore_1.default.deploySdl), setDeploySdl = _p[1];
    var muiTheme = (0, styles_1.useTheme)();
    var smallScreen = (0, useMediaQuery_1.default)(muiTheme.breakpoints.down("md"));
    var sdlBuilderRef = (0, react_1.useRef)(null);
    var hasComponent = (0, SdlBuilderProvider_1.useSdlBuilder)().hasComponent;
    var searchParams = (0, navigation_1.useSearchParams)();
    var templateId = searchParams.get("templateId");
    var depositParams = (0, useSaveSettings_1.useDepositParams)().data;
    var defaultDeposit = depositParams || appConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT;
    var wallet = (0, WalletProvider_1.useWallet)();
    var managedDenom = (0, useManagedWalletDenom_1.useManagedWalletDenom)();
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var services = (0, useImportSimpleSdl_1.useImportSimpleSdl)(editedManifest);
    (0, useWhen_1.useWhen)(wallet.isManaged && sdlDenom === "uakt" && editedManifest, function () {
        setEditedManifest(function (prev) { return (prev ? prev.replace(/uakt/g, managedDenom) : prev); });
        setSdlDenom(managedDenom);
    }, [editedManifest, wallet.isManaged, sdlDenom]);
    (0, useWhen_1.useWhen)(hasComponent("ssh"), function () {
        setSelectedSdlEditMode("builder");
    });
    (0, useWhen_1.useWhen)(isGitProviderTemplate, function () {
        setSelectedSdlEditMode("builder");
    }, [isGitProviderTemplate]);
    (0, react_1.useEffect)(function () {
        if (selectedTemplate === null || selectedTemplate === void 0 ? void 0 : selectedTemplate.name) {
            setDeploymentName(selectedTemplate.name);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    (0, react_1.useEffect)(function () {
        var timer = (0, timer_1.Timer)(500);
        timer.start().then(function () {
            if (editedManifest)
                createAndValidateDeploymentData(editedManifest, "TEST_DSEQ_VALIDATION");
        });
        return function () {
            if (timer) {
                timer.abort();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editedManifest]);
    var onFileSelect = function (file) {
        if (!file)
            return;
        var reader = new FileReader();
        reader.onload = function (event) {
            var _a, _b;
            onTemplateSelected({
                title: "From file",
                code: "from-file",
                category: "General",
                description: "Custom uploaded file",
                content: (_a = event.target) === null || _a === void 0 ? void 0 : _a.result
            });
            setEditedManifest((_b = event.target) === null || _b === void 0 ? void 0 : _b.result);
            setSelectedSdlEditMode("yaml");
            analyticsService.track("sdl_uploaded", "Amplitude");
        };
        reader.readAsText(file);
    };
    function handleTextChange(value) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                setEditedManifest(value || "");
                return [2 /*return*/];
            });
        });
    }
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
                        (0, deploymentUtils_1.validateDeploymentData)(dd, selectedTemplate);
                        setSdlDenom(dd.deposit.denom);
                        setParsingError(null);
                        return [2 /*return*/, dd];
                    case 2:
                        err_1 = _a.sent();
                        if (err_1.name === "YAMLException" || err_1.name === "CustomValidationError") {
                            setParsingError(err_1.message);
                        }
                        else if (err_1.name === "TemplateValidation") {
                            setParsingError(err_1.message);
                        }
                        else {
                            setParsingError("Error while parsing SDL file");
                            console.error(err_1);
                        }
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    var handleCreateDeployment = function () { return __awaiter(void 0, void 0, void 0, function () {
        var valid;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    analyticsService.track("create_deployment_btn_clk", "Amplitude");
                    if (isGitProviderTemplate && !isRepoInputValid) {
                        enqueueSnackbar(<components_1.Snackbar title={"Please Fill All Required Fields"} subTitle="You need fill repo url and branch to deploy" iconVariant="error"/>, {
                            variant: "error"
                        });
                        return [2 /*return*/];
                    }
                    if (!(selectedSdlEditMode === "builder")) return [3 /*break*/, 2];
                    return [4 /*yield*/, ((_a = sdlBuilderRef.current) === null || _a === void 0 ? void 0 : _a.validate())];
                case 1:
                    valid = _b.sent();
                    if (!valid)
                        return [2 /*return*/];
                    _b.label = 2;
                case 2:
                    if (isManaged) {
                        if (!services || (services === null || services === void 0 ? void 0 : services.length) === 0) {
                            setParsingError("Error while parsing SDL file");
                            return [2 /*return*/];
                        }
                        setIsDepositingDeployment(true);
                    }
                    else {
                        setIsCheckingPrerequisites(true);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var onPrerequisiteContinue = function () {
        setIsCheckingPrerequisites(false);
        if (isManaged) {
            handleCreateClick(defaultDeposit);
        }
        else {
            setIsDepositingDeployment(true);
        }
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
    function handleCreateClick(deposit) {
        return __awaiter(this, void 0, void 0, function () {
            var sdl, _a, dd, newCert, messages, response;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, , 7, 8]);
                        setIsCreatingDeployment(true);
                        sdl = selectedSdlEditMode === "yaml" ? editedManifest : (_b = sdlBuilderRef.current) === null || _b === void 0 ? void 0 : _b.getSdl();
                        if (!sdl) {
                            setIsCreatingDeployment(false);
                            return [2 /*return*/];
                        }
                        if (isAnonymousFreeTrialEnabled) {
                            if (isTrialing && !isOnboarding) {
                                sdl = (0, v1beta3_1.appendTrialAttribute)(sdl, v1beta3_1.TRIAL_ATTRIBUTE);
                            }
                            else if (isOnboarding) {
                                sdl = (0, v1beta3_1.appendTrialAttribute)(sdl, v1beta3_1.TRIAL_REGISTERED_ATTRIBUTE);
                            }
                        }
                        if (isManaged) {
                            sdl = (0, v1beta3_1.appendAuditorRequirement)(sdl);
                        }
                        return [4 /*yield*/, Promise.all([createAndValidateDeploymentData(sdl, null, deposit), genNewCertificateIfLocalIsInvalid()])];
                    case 1:
                        _a = _c.sent(), dd = _a[0], newCert = _a[1];
                        if (!dd)
                            return [2 /*return*/];
                        messages = [];
                        // Create a cert if the user doesn't have one
                        if (newCert) {
                            messages.push(TransactionMessageData_1.TransactionMessageData.getCreateCertificateMsg(address, newCert.cert, newCert.publicKey));
                        }
                        messages.push(TransactionMessageData_1.TransactionMessageData.getCreateDeploymentMsg(dd));
                        return [4 /*yield*/, signAndBroadcastTx(messages)];
                    case 2:
                        response = _c.sent();
                        if (!response) return [3 /*break*/, 5];
                        if (!newCert) return [3 /*break*/, 4];
                        return [4 /*yield*/, updateSelectedCertificate(newCert)];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        setDeploySdl(null);
                        deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
                            manifest: sdl,
                            manifestVersion: dd.hash,
                            name: deploymentName
                        });
                        router.replace(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.createLeases, dseq: dd.deploymentId.dseq }));
                        analyticsService.track("create_deployment", {
                            category: "deployments",
                            label: "Create deployment in wizard"
                        });
                        return [3 /*break*/, 6];
                    case 5:
                        setIsCreatingDeployment(false);
                        _c.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        setIsCreatingDeployment(false);
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    var changeMode = function (mode) {
        var _a;
        if (mode === selectedSdlEditMode)
            return;
        if (mode === "yaml") {
            if (editedManifest) {
                setEditedManifest(editedManifest);
            }
        }
        else {
            var sdl = (_a = sdlBuilderRef.current) === null || _a === void 0 ? void 0 : _a.getSdl();
            if (sdl) {
                setEditedManifest(sdl);
            }
        }
        setSelectedSdlEditMode(mode);
    };
    var deployments = (0, useDeploymentQuery_1.useDeploymentList)(address).data;
    var trialDeploymentLimitReached = (0, react_1.useMemo)(function () {
        return isAnonymousFreeTrialEnabled && isTrialing && ((deployments === null || deployments === void 0 ? void 0 : deployments.length) || 0) >= TRIAL_DEPLOYMENT_LIMIT;
    }, [deployments === null || deployments === void 0 ? void 0 : deployments.length, isTrialing, isAnonymousFreeTrialEnabled]);
    return (<>
      <CustomNextSeo_1.CustomNextSeo title="Create Deployment - Manifest Edit" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment }))}/>

      {trialDeploymentLimitReached && (<div className="pb-4 pt-4">
          <components_1.Alert variant="warning" className="backdrop-blur-md md:mb-0">
            <components_1.AlertDescription className="space-y-1 dark:text-white/90">
              <p>
                You have reached the limit of {TRIAL_DEPLOYMENT_LIMIT} trial deployments.{" "}
                <link_1.default href={urlUtils_1.UrlService.login()} className="font-bold underline">
                  Sign in
                </link_1.default>{" "}
                or <SignUpButton_1.SignUpButton className="font-bold underline"/> to add funds and continue deploying.
              </p>
            </components_1.AlertDescription>
          </components_1.Alert>
        </div>)}

      <div className="mb-2 pt-4">
        <div className="mb-2 flex flex-col items-end justify-between md:flex-row">
          <div className="w-full flex-grow">
            <components_1.Input value={deploymentName} onChange={function (ev) { return setDeploymentName(ev.target.value); }} label="Name your deployment (optional)"/>
          </div>

          <div className="flex w-full min-w-0 flex-shrink-0 items-center pt-2 md:w-auto md:pt-0">
            <components_1.CustomTooltip title={<p>
                  You may use the sample deployment file as-is or modify it for your own needs as described in the{" "}
                  <LinkTo_1.LinkTo onClick={function (ev) { return (0, urlUtils_1.handleDocClick)(ev, "https://akash.network/docs/getting-started/stack-definition-language/"); }}>
                    SDL (Stack Definition Language)
                  </LinkTo_1.LinkTo>{" "}
                  documentation. A typical modification would be to reference your own image instead of the demo app image.
                </p>}>
              <iconoir_react_1.InfoCircle className="mr-4 text-sm text-muted-foreground md:ml-4"/>
            </components_1.CustomTooltip>

            <div className="flex-grow">
              <components_1.Button variant="default" disabled={settings.isBlockchainDown || trialDeploymentLimitReached || isCreatingDeployment || !!parsingError || !editedManifest} onClick={function () { return handleCreateDeployment(); }} className="w-full whitespace-nowrap sm:w-auto" data-testid="create-deployment-btn">
                {isCreatingDeployment ? (<components_1.Spinner size="small"/>) : (<>
                    Create Deployment{" "}
                    <span className="ml-2 flex items-center">
                      <iconoir_react_1.ArrowRight fontSize="small"/>
                    </span>
                  </>)}
              </components_1.Button>
            </div>
          </div>
        </div>
      </div>

      {!isGitProviderTemplate && (<div className="mb-2 flex gap-2">
          {hasComponent("yml-editor") && (<div className="flex items-center">
              <components_1.Button variant={selectedSdlEditMode === "builder" ? "default" : "outline"} onClick={function () {
                    changeMode("builder");
                    analyticsService.track("builder_mode_btn_clk", "Amplitude");
                }} size="sm" className={(0, utils_1.cn)("flex-grow sm:flex-grow-0", { "rounded-e-none": hasComponent("yml-editor") })} disabled={!!parsingError && selectedSdlEditMode === "yaml"}>
                Builder
              </components_1.Button>
              <components_1.Button variant={selectedSdlEditMode === "yaml" ? "default" : "outline"} color={selectedSdlEditMode === "yaml" ? "secondary" : "primary"} onClick={function () {
                    changeMode("yaml");
                    analyticsService.track("yml_mode_btn_clk", "Amplitude");
                }} size="sm" className="flex-grow rounded-s-none sm:flex-grow-0">
                YAML
              </components_1.Button>
            </div>)}
          {hasComponent("yml-uploader") && !templateId && (<>
              <components_1.FileButton onFileSelect={onFileSelect} accept=".yml,.yaml,.txt" size="sm" variant="outline" className="flex-grow hover:bg-primary hover:text-white sm:flex-grow-0">
                <iconoir_react_1.Upload className="text-xs"/>
                <span className="text-xs">Upload your SDL</span>
              </components_1.FileButton>
            </>)}
        </div>)}

      {parsingError && <components_1.Alert variant="warning">{parsingError}</components_1.Alert>}

      {hasComponent("yml-editor") && selectedSdlEditMode === "yaml" && (<ViewPanel_1.default stickToBottom className={(0, utils_1.cn)("overflow-hidden", (_b = {}, _b["-mx-4"] = smallScreen, _b))}>
          <DynamicMonacoEditor_1.DynamicMonacoEditor value={editedManifest || ""} onChange={handleTextChange}/>
        </ViewPanel_1.default>)}
      {(hasComponent("ssh") || selectedSdlEditMode === "builder") && (<SdlBuilder_1.SdlBuilder sdlString={editedManifest} ref={sdlBuilderRef} isGitProviderTemplate={isGitProviderTemplate} setEditedManifest={setEditedManifest} setDeploymentName={setDeploymentName} deploymentName={deploymentName} setIsRepoInputValid={setIsRepoInputValid}/>)}

      {isDepositingDeployment && (<DeploymentDepositModal_1.DeploymentDepositModal handleCancel={function () { return setIsDepositingDeployment(false); }} onDeploymentDeposit={onDeploymentDeposit} denom={sdlDenom} title="Confirm deployment creation?" infoText={<components_1.Alert className="mb-4 text-xs" variant="default">
              <DeploymentMinimumEscrowAlertText_1.DeploymentMinimumEscrowAlertText />
              <LinkTo_1.LinkTo onClick={function (ev) { return (0, urlUtils_1.handleDocClick)(ev, "https://akash.network/docs/getting-started/intro-to-akash/payments/#escrow-accounts"); }}>
                <strong>Learn more.</strong>
              </LinkTo_1.LinkTo>

              {!isAnonymousFreeTrialEnabled && isTrialing && (<div className="mt-2">
                  <shared_1.TrialDeploymentBadge />
                </div>)}
            </components_1.Alert>} services={services}/>)}
      {isCheckingPrerequisites && <PrerequisiteList_1.PrerequisiteList onClose={function () { return setIsCheckingPrerequisites(false); }} onContinue={onPrerequisiteContinue}/>}
    </>);
};
exports.ManifestEdit = ManifestEdit;
