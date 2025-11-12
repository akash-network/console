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
exports.ManifestUpdate = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var js_yaml_1 = require("js-yaml");
var notistack_1 = require("notistack");
var DynamicMonacoEditor_1 = require("@src/components/shared/DynamicMonacoEditor");
var LinearLoadingSkeleton_1 = require("@src/components/shared/LinearLoadingSkeleton");
var LinkTo_1 = require("@src/components/shared/LinkTo");
var ViewPanel_1 = require("@src/components/shared/ViewPanel");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useProviderCredentials_1 = require("@src/hooks/useProviderCredentials/useProviderCredentials");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var networkStore_1 = require("@src/store/networkStore");
var deploymentData_1 = require("@src/utils/deploymentData");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var RemoteDeployUpdate_1 = require("../remote-deploy/update/RemoteDeployUpdate");
var ManifestErrorSnackbar_1 = require("../shared/ManifestErrorSnackbar");
var Title_1 = require("../shared/Title");
var CreateCredentialsButton_1 = require("./CreateCredentialsButton/CreateCredentialsButton");
var ManifestUpdate = function (_a) {
    var deployment = _a.deployment, leases = _a.leases, closeManifestEditor = _a.closeManifestEditor, isRemoteDeploy = _a.isRemoteDeploy, editedManifest = _a.editedManifest, onManifestChange = _a.onManifestChange;
    var _b = (0, ServicesProvider_1.useServices)(), providerProxy = _b.providerProxy, analyticsService = _b.analyticsService, chainApiHttpClient = _b.chainApiHttpClient, deploymentLocalStorage = _b.deploymentLocalStorage;
    var _c = (0, react_1.useState)(null), parsingError = _c[0], setParsingError = _c[1];
    var _d = (0, react_1.useState)(null), deploymentVersion = _d[0], setDeploymentVersion = _d[1];
    var _e = (0, react_1.useState)(false), showOutsideDeploymentMessage = _e[0], setShowOutsideDeploymentMessage = _e[1];
    var _f = (0, react_1.useState)(false), isSendingManifest = _f[0], setIsSendingManifest = _f[1];
    var _g = (0, WalletProvider_1.useWallet)(), address = _g.address, signAndBroadcastTx = _g.signAndBroadcastTx, isManagedWallet = _g.isManaged;
    var providers = (0, useProvidersQuery_1.useProviderList)().data;
    var providerCredentials = (0, useProviderCredentials_1.useProviderCredentials)();
    var _h = (0, notistack_1.useSnackbar)(), enqueueSnackbar = _h.enqueueSnackbar, closeSnackbar = _h.closeSnackbar;
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    (0, react_1.useEffect)(function () {
        var init = function () { return __awaiter(void 0, void 0, void 0, function () {
            var localDeploymentData, yamlVersion, version, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        localDeploymentData = deploymentLocalStorage.get(address, deployment.dseq);
                        if (!(localDeploymentData === null || localDeploymentData === void 0 ? void 0 : localDeploymentData.manifest)) return [3 /*break*/, 5];
                        onManifestChange(localDeploymentData.manifest);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        yamlVersion = js_yaml_1.default.load(localDeploymentData.manifest);
                        return [4 /*yield*/, deploymentData_1.deploymentData.getManifestVersion(yamlVersion)];
                    case 2:
                        version = _a.sent();
                        setDeploymentVersion(version);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error(error_1);
                        setParsingError("Error getting manifest version.");
                        return [3 /*break*/, 4];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        setShowOutsideDeploymentMessage(true);
                        _a.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        }); };
        init();
    }, [deployment, address, deploymentLocalStorage]);
    /**
     * Validate the manifest periodically
     */
    (0, react_1.useEffect)(function () {
        function createAndValidateDeploymentData(yamlStr, dseq) {
            return __awaiter(this, void 0, void 0, function () {
                var err_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            if (!editedManifest)
                                return [2 /*return*/, null];
                            return [4 /*yield*/, deploymentData_1.deploymentData.NewDeploymentData(chainApiHttpClient, yamlStr, dseq, address)];
                        case 1:
                            _a.sent();
                            setParsingError(null);
                            return [3 /*break*/, 3];
                        case 2:
                            err_1 = _a.sent();
                            if (err_1.name === "YAMLException" || err_1.name === "CustomValidationError") {
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
        var timeoutId = setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, createAndValidateDeploymentData(editedManifest, deployment.dseq)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }, 500);
        return function () {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [editedManifest, deployment.dseq, chainApiHttpClient, address]);
    function handleTextChange(value) {
        onManifestChange(value || "");
        if (deploymentVersion) {
            setDeploymentVersion(null);
        }
    }
    function handleUpdateDocClick(ev) {
        ev.preventDefault();
        window.open("https://akash.network/docs/deployments/akash-cli/installation/#update-the-deployment", "_blank");
    }
    var chainNetwork = networkStore_1.default.useSelectedNetworkId();
    function sendManifest(providerInfo, manifest) {
        return __awaiter(this, void 0, void 0, function () {
            var err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, providerProxy.sendManifest(providerInfo, manifest, {
                                dseq: deployment.dseq,
                                credentials: providerCredentials.details,
                                chainNetwork: chainNetwork
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        err_2 = _a.sent();
                        enqueueSnackbar(<ManifestErrorSnackbar_1.ManifestErrorSnackbar err={err_2}/>, { variant: "error", autoHideDuration: null });
                        throw err_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    function handleUpdateClick() {
        return __awaiter(this, void 0, void 0, function () {
            var response, sendManifestKey, doc, dd, mani, message, leaseProviders, _loop_1, _i, leaseProviders_1, provider, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 11]);
                        doc = js_yaml_1.default.load(editedManifest);
                        return [4 /*yield*/, deploymentData_1.deploymentData.NewDeploymentData(chainApiHttpClient, editedManifest, deployment.dseq, address)];
                    case 1:
                        dd = _a.sent();
                        mani = deploymentData_1.deploymentData.getManifest(doc, true);
                        if (!(Buffer.from(dd.hash).toString("base64") !== deployment.hash)) return [3 /*break*/, 3];
                        message = TransactionMessageData_1.TransactionMessageData.getUpdateDeploymentMsg(dd);
                        return [4 /*yield*/, signAndBroadcastTx([message])];
                    case 2:
                        response = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        response = true;
                        _a.label = 4;
                    case 4:
                        if (!response) return [3 /*break*/, 9];
                        setIsSendingManifest(true);
                        deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
                            manifest: editedManifest,
                            manifestVersion: dd.hash
                        });
                        sendManifestKey =
                            !isManagedWallet &&
                                enqueueSnackbar(<components_1.Snackbar title="Deploying! 🚀" subTitle="Please wait a few seconds..." showLoading/>, {
                                    variant: "info",
                                    autoHideDuration: null
                                });
                        leaseProviders = leases.map(function (lease) { return lease.provider; }).filter(function (v, i, s) { return s.indexOf(v) === i; });
                        _loop_1 = function (provider) {
                            var providerInfo;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        providerInfo = providers === null || providers === void 0 ? void 0 : providers.find(function (x) { return x.owner === provider; });
                                        return [4 /*yield*/, sendManifest(providerInfo, mani)];
                                    case 1:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, leaseProviders_1 = leaseProviders;
                        _a.label = 5;
                    case 5:
                        if (!(_i < leaseProviders_1.length)) return [3 /*break*/, 8];
                        provider = leaseProviders_1[_i];
                        return [5 /*yield**/, _loop_1(provider)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 5];
                    case 8:
                        analyticsService.track("update_deployment", {
                            category: "deployments",
                            label: "Update deployment"
                        });
                        setIsSendingManifest(false);
                        if (sendManifestKey) {
                            closeSnackbar(sendManifestKey);
                        }
                        closeManifestEditor();
                        _a.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        error_2 = _a.sent();
                        console.error(error_2);
                        setIsSendingManifest(false);
                        if (sendManifestKey) {
                            closeSnackbar(sendManifestKey);
                        }
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        });
    }
    return (<>
      {showOutsideDeploymentMessage ? (<div className="p-2">
          <components_1.Alert>
            It looks like this deployment was created using another deploy tool. We can't show you the configuration file that was used initially, but you can
            still update it. Simply continue and enter the configuration you want to use.
            <div className="mt-1">
              <components_1.Button onClick={function () { return setShowOutsideDeploymentMessage(false); }} size="sm">
                Continue
              </components_1.Button>
            </div>
          </components_1.Alert>
        </div>) : (<>
          <div>
            <div className="flex h-[50px] items-center justify-between space-x-2 px-2 py-1">
              <div className="flex items-center space-x-2">
                <Title_1.Title subTitle className="!text-base">
                  Update Deployment
                </Title_1.Title>

                <components_1.CustomTooltip title={<div>
                      Akash Groups are translated into Kubernetes Deployments, this means that only a few fields from the Akash SDL are mutable. For example
                      image, command, args, env and exposed ports can be modified, but compute resources and placement criteria cannot. (
                      <LinkTo_1.LinkTo onClick={handleUpdateDocClick}>View doc</LinkTo_1.LinkTo>)
                    </div>}>
                  <iconoir_react_1.InfoCircle className="text-xs text-muted-foreground"/>
                </components_1.CustomTooltip>

                {!!deploymentVersion && deploymentVersion !== deployment.hash && (<components_1.CustomTooltip title={<components_1.Alert variant="warning">
                        Your local deployment file version doesn't match the one on-chain. If you click update, you will override the deployed version.
                      </components_1.Alert>}>
                    <iconoir_react_1.WarningCircle className="text-xs text-warning"/>
                  </components_1.CustomTooltip>)}
              </div>

              <div>
                {!providerCredentials.details.usable ? (<CreateCredentialsButton_1.CreateCredentialsButton containerClassName="flex items-center space-x-4 text-sm" className="" size="sm"/>) : (<components_1.Button disabled={!!parsingError || !editedManifest || !providers || isSendingManifest || deployment.state !== "active" || settings.isBlockchainDown} onClick={function () { return handleUpdateClick(); }} size="sm" type="button">
                    Update Deployment
                  </components_1.Button>)}
              </div>
            </div>

            {parsingError && <components_1.Alert variant="warning">{parsingError}</components_1.Alert>}

            <LinearLoadingSkeleton_1.LinearLoadingSkeleton isLoading={isSendingManifest}/>

            <ViewPanel_1.default stickToBottom style={{ overflow: isRemoteDeploy ? "unset" : "hidden" }}>
              {isRemoteDeploy ? (<RemoteDeployUpdate_1.default sdlString={editedManifest} onManifestChange={onManifestChange}/>) : (<DynamicMonacoEditor_1.DynamicMonacoEditor value={editedManifest} onChange={handleTextChange}/>)}
            </ViewPanel_1.default>
          </div>
        </>)}
    </>);
};
exports.ManifestUpdate = ManifestUpdate;
