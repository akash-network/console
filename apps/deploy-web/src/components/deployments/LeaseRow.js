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
exports.LeaseRow = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var js_yaml_1 = require("js-yaml");
var get_1 = require("lodash/get");
var link_1 = require("next/link");
var notistack_1 = require("notistack");
var AuditorButton_1 = require("@src/components/providers/AuditorButton");
var CodeSnippet_1 = require("@src/components/shared/CodeSnippet");
var FavoriteButton_1 = require("@src/components/shared/FavoriteButton");
var LabelValueOld_1 = require("@src/components/shared/LabelValueOld");
var PriceEstimateTooltip_1 = require("@src/components/shared/PriceEstimateTooltip");
var PricePerMonth_1 = require("@src/components/shared/PricePerMonth");
var SpecDetail_1 = require("@src/components/shared/SpecDetail");
var StatusPill_1 = require("@src/components/shared/StatusPill");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useProviderCredentials_1 = require("@src/hooks/useProviderCredentials/useProviderCredentials");
var useBidQuery_1 = require("@src/queries/useBidQuery");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var networkStore_1 = require("@src/store/networkStore");
var copyClipboard_1 = require("@src/utils/copyClipboard");
var deploymentData_1 = require("@src/utils/deploymentData");
var deploymentUtils_1 = require("@src/utils/deploymentUtils");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var data_1 = require("@src/utils/sdl/data");
var CopyTextToClipboardButton_1 = require("../shared/CopyTextToClipboardButton");
var ManifestErrorSnackbar_1 = require("../shared/ManifestErrorSnackbar");
var ProviderName_1 = require("../shared/ProviderName");
exports.LeaseRow = react_1.default.forwardRef(function (_a, ref) {
    var _b;
    var index = _a.index, lease = _a.lease, deploymentManifest = _a.deploymentManifest, dseq = _a.dseq, providers = _a.providers, loadDeploymentDetail = _a.loadDeploymentDetail, isRemoteDeploy = _a.isRemoteDeploy, repo = _a.repo;
    var providerProxy = (0, ServicesProvider_1.useServices)().providerProxy;
    var provider = providers === null || providers === void 0 ? void 0 : providers.find(function (p) { return p.owner === (lease === null || lease === void 0 ? void 0 : lease.provider); });
    var providerCredentials = (0, useProviderCredentials_1.useProviderCredentials)();
    var isLeaseActive = lease.state === "active";
    var _c = (0, react_1.useState)(false), isServicesAvailable = _c[0], setIsServicesAvailable = _c[1];
    var _d = (0, LocalNoteProvider_1.useLocalNotes)(), favoriteProviders = _d.favoriteProviders, updateFavoriteProviders = _d.updateFavoriteProviders;
    var isFavorite = favoriteProviders.some(function (x) { return (lease === null || lease === void 0 ? void 0 : lease.provider) === x; });
    var _e = (0, useLeaseQuery_1.useLeaseStatus)({
        provider: provider,
        lease: lease,
        enabled: isLeaseActive && !isServicesAvailable && !!(provider === null || provider === void 0 ? void 0 : provider.hostUri) && providerCredentials.details.usable,
        refetchInterval: 10000
    }), leaseStatus = _e.data, error = _e.error, getLeaseStatus = _e.refetch, isLoadingLeaseStatus = _e.isLoading;
    (0, react_1.useEffect)(function () {
        if (leaseStatus) {
            checkIfServicesAreAvailable(leaseStatus);
        }
    }, [leaseStatus]);
    var _f = (0, useProvidersQuery_1.useProviderStatus)(provider, {
        enabled: false,
        retry: false
    }), isLoadingProviderStatus = _f.isLoading, getProviderStatus = _f.refetch;
    var errorMessage = typeof error === "string" ? error : error === null || error === void 0 ? void 0 : error.message;
    var isLeaseNotFound = (errorMessage === null || errorMessage === void 0 ? void 0 : errorMessage.includes("lease not found")) && isLeaseActive;
    var servicesNames = (0, react_1.useMemo)(function () { return (leaseStatus ? Object.keys(leaseStatus.services) : []); }, [leaseStatus]);
    var _g = (0, react_1.useState)(false), isSendingManifest = _g[0], setIsSendingManifest = _g[1];
    var bid = (0, useBidQuery_1.useBidInfo)(lease.owner, lease.dseq, lease.gseq, lease.oseq, lease.provider).data;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    react_1.default.useImperativeHandle(ref, function () { return ({
        getLeaseStatus: loadLeaseStatus
    }); });
    var loadLeaseStatus = (0, react_1.useCallback)(function () {
        if (isLeaseActive && provider && providerCredentials.details.usable) {
            getLeaseStatus();
            getProviderStatus();
        }
    }, [isLeaseActive, provider, providerCredentials.details, getLeaseStatus, getProviderStatus]);
    var parsedManifest = (0, react_1.useMemo)(function () { return js_yaml_1.default.load(deploymentManifest); }, [deploymentManifest]);
    var checkIfServicesAreAvailable = function (leaseStatus) {
        var servicesNames = leaseStatus ? Object.keys(leaseStatus.services) : [];
        var isServicesAvailable = servicesNames.length > 0
            ? servicesNames
                .map(function (n) { return leaseStatus.services[n]; })
                .every(function (service) {
                return service.available > 0;
            })
            : false;
        setIsServicesAvailable(isServicesAvailable);
    };
    (0, react_1.useEffect)(function () {
        loadLeaseStatus();
    }, [lease, provider, providerCredentials.details, loadLeaseStatus]);
    var chainNetwork = networkStore_1.default.useSelectedNetworkId();
    function sendManifest() {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setIsSendingManifest(true);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        manifest = deploymentData_1.deploymentData.getManifest(parsedManifest, true);
                        return [4 /*yield*/, providerProxy.sendManifest(provider, manifest, { dseq: dseq, credentials: providerCredentials.details, chainNetwork: chainNetwork })];
                    case 2:
                        _a.sent();
                        enqueueSnackbar(<components_1.Snackbar title="Manifest sent!" iconVariant="success"/>, { variant: "success", autoHideDuration: 10000 });
                        loadDeploymentDetail();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        enqueueSnackbar(<ManifestErrorSnackbar_1.ManifestErrorSnackbar err={err_1}/>, { variant: "error", autoHideDuration: null });
                        return [3 /*break*/, 4];
                    case 4:
                        setIsSendingManifest(false);
                        return [2 /*return*/];
                }
            });
        });
    }
    var onStarClick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        var newFavorites = isFavorite ? favoriteProviders.filter(function (x) { return x !== lease.provider; }) : favoriteProviders.concat([lease.provider]);
        updateFavoriteProviders(newFavorites);
    };
    var gpuModels = bid && bid.bid.resources_offer.flatMap(function (x) { return (0, deploymentUtils_1.getGpusFromAttributes)(x.resources.gpu.attributes); });
    var sshInstructions = (0, react_1.useMemo)(function () {
        return servicesNames.reduce(function (acc, serviceName) {
            var _a;
            if (!data_1.sshVmImages.has((0, get_1.default)(parsedManifest, ["services", serviceName, "image"]))) {
                return acc;
            }
            var exposes = (_a = leaseStatus === null || leaseStatus === void 0 ? void 0 : leaseStatus.forwarded_ports) === null || _a === void 0 ? void 0 : _a[serviceName];
            if (!exposes)
                return acc;
            return exposes === null || exposes === void 0 ? void 0 : exposes.reduce(function (exposesAcc, expose) {
                if (expose.port !== 22) {
                    return exposesAcc;
                }
                if (exposesAcc) {
                    exposesAcc += "\n";
                }
                return exposesAcc.concat("ssh root@".concat(expose.host, " -p ").concat(expose.externalPort, " -i ~/.ssh/id_rsa"));
            }, acc);
        }, "");
    }, [parsedManifest, servicesNames, leaseStatus]);
    return (<components_1.Card className="mb-4">
        <components_1.CardHeader className="bg-secondary py-2">
          <div className="flex items-center">
            <div className="inline-flex items-center text-xs text-muted-foreground">
              <span data-testid={"lease-row-".concat(index, "-state")}>{lease.state}</span>
              <StatusPill_1.StatusPill state={lease.state} size="small"/>

              <span className="ml-4 text-muted-foreground">GSEQ:</span>
              <span className="ml-1">{lease.gseq}</span>

              <span className="ml-4">OSEQ:</span>
              <span className="ml-1">{lease.oseq}</span>
            </div>

            {isLeaseActive && (<div className="ml-4 inline-flex">
                <link_1.default className="text-sm" href={"/deployments/".concat(dseq, "?tab=LOGS")}>
                  View logs
                </link_1.default>
              </div>)}
          </div>
        </components_1.CardHeader>
        <components_1.CardContent className="pt-4">
          <div className="space-y-2">
            <div className="mb-4">
              <SpecDetail_1.SpecDetail cpuAmount={lease.cpuAmount} gpuAmount={lease.gpuAmount} gpuModels={gpuModels} memoryAmount={lease.memoryAmount} storageAmount={lease.storageAmount} color="secondary" size="medium"/>
            </div>
            <LabelValueOld_1.LabelValueOld label="Price:" value={<div className="flex items-center">
                  <PricePerMonth_1.PricePerMonth denom={lease.price.denom} perBlockValue={(0, mathHelpers_1.udenomToDenom)(lease.price.amount, 10)} className="text-lg"/>
                  <PriceEstimateTooltip_1.PriceEstimateTooltip denom={lease.price.denom} value={lease.price.amount}/>
                </div>}/>

            <LabelValueOld_1.LabelValueOld label="Provider:" value={<>
                  {isLeaseActive && isLoadingProviderStatus && <components_1.Spinner size="small" className="mr-2"/>}
                  {provider && (<div className="flex items-center space-x-2">
                      <ProviderName_1.ProviderName provider={provider}/>

                      <div className="flex items-center space-x-2">
                        <CopyTextToClipboardButton_1.CopyTextToClipboardButton value={(_b = provider.name) !== null && _b !== void 0 ? _b : provider.hostUri}/>
                        <FavoriteButton_1.FavoriteButton isFavorite={isFavorite} onClick={onStarClick}/>

                        {(provider === null || provider === void 0 ? void 0 : provider.isAudited) && (<div className="ml-2">
                            <AuditorButton_1.AuditorButton provider={provider}/>
                          </div>)}
                      </div>
                    </div>)}
                </>}/>
          </div>

          {isLeaseNotFound && (<components_1.Alert variant="warning">
              The lease was not found on this provider. This can happen if no manifest was sent to the provider. To send one you can update your deployment in
              the <link_1.default href={"/deployments/".concat(dseq, "?tab=EDIT")}>VIEW / EDIT MANIFEST</link_1.default> tab.
              {deploymentManifest && (<>
                  <div className="my-4">
                    <strong>OR</strong>
                  </div>
                  <components_1.Button variant="default" color="secondary" disabled={isSendingManifest} onClick={sendManifest} size="sm">
                    {isSendingManifest ? <components_1.Spinner size="small"/> : <span>Send manifest manually</span>}
                  </components_1.Button>
                </>)}
            </components_1.Alert>)}

          {!leaseStatus && isLoadingLeaseStatus && <components_1.Spinner size="small"/>}

          {isLeaseActive &&
            leaseStatus &&
            leaseStatus.services &&
            servicesNames
                .map(function (n) { return leaseStatus.services[n]; })
                .map(function (service, i) {
                var _a, _b, _c;
                var _d, _e, _f, _g, _h, _j;
                return (<div className={(0, utils_1.cn)("mt-2", (_a = {},
                        _a["border-b pb-2"] = servicesNames.length > 1 && i !== servicesNames.length - 1,
                        _a))} key={"".concat(service.name, "_").concat(i)}>
                  <div className="flex items-center">
                    <LabelValueOld_1.LabelValueOld label="Group:" value={service.name}/>
                    {isLoadingLeaseStatus || !isServicesAvailable ? (<div className="ml-4 inline-flex">
                        <components_1.Spinner size="small"/>
                      </div>) : (<div className="ml-2 inline-flex">
                        <components_1.CustomTooltip title={<>
                              Workloads can take some time to spin up. If you see an error when browsing the uri, it is recommended to refresh and wait a bit.
                              Check the{" "}
                              <link_1.default href={"/deployments/".concat(dseq, "?tab=LOGS")} className="text-white">
                                logs
                              </link_1.default>{" "}
                              for more information.
                            </>}>
                          <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground" fontSize="small"/>
                        </components_1.CustomTooltip>
                      </div>)}

                    {isServicesAvailable && (<div className="ml-2">
                        <iconoir_react_1.Check className="text-sm text-green-600"/>
                      </div>)}
                  </div>

                  <div className={(0, utils_1.cn)("flex items-center space-x-4", (_b = {},
                        _b["mb-4"] = ((_d = service.uris) === null || _d === void 0 ? void 0 : _d.length) > 0 || (leaseStatus.forwarded_ports && ((_e = leaseStatus.forwarded_ports[service.name]) === null || _e === void 0 ? void 0 : _e.length) > 0),
                        _b))}>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">Available:&nbsp;</span>
                      <components_1.Badge variant={service.available > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                        <small>{service.available}</small>
                      </components_1.Badge>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">Ready Replicas:&nbsp;</span>
                      <components_1.Badge variant={service.ready_replicas > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                        <small>{service.ready_replicas}</small>
                      </components_1.Badge>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">Total:&nbsp;</span>
                      <components_1.Badge variant={service.total > 0 ? "success" : "destructive"} className="h-3 px-1 text-xs leading-3">
                        <small>{service.total}</small>
                      </components_1.Badge>
                    </div>
                  </div>

                  {leaseStatus.forwarded_ports && ((_f = leaseStatus.forwarded_ports[service.name]) === null || _f === void 0 ? void 0 : _f.length) > 0 && !isRemoteDeploy && (<div className={(0, utils_1.cn)((_c = {}, _c["mb-4"] = ((_g = service.uris) === null || _g === void 0 ? void 0 : _g.length) > 0, _c))}>
                      <LabelValueOld_1.LabelValueOld label="Forwarded Ports:" value={<div className="inline-flex items-center space-x-2">
                            {leaseStatus.forwarded_ports[service.name].map(function (p) {
                                var _a;
                                return (<div key={"port_" + p.externalPort}>
                                {p.host ? (<link_1.default className={(0, utils_1.cn)((_a = {}, _a["cursor-none text-muted-foreground"] = p.available < 1, _a), "inline-flex items-center space-x-2 text-sm")} href={"http://".concat(p.host, ":").concat(p.externalPort)} target="_blank">
                                    <span>
                                      {p.port}:{p.externalPort}
                                    </span>
                                    <iconoir_react_1.OpenInWindow className="text-xs"/>
                                  </link_1.default>) : (<components_1.Badge variant="outline">{"".concat(p.port, ":").concat(p.externalPort)}</components_1.Badge>)}
                              </div>);
                            })}
                          </div>}/>
                    </div>)}

                  {isRemoteDeploy && repo && (<div className="mt-2">
                      <LabelValueOld_1.LabelValueOld label="Deployed Repo:"/>
                      <ul className="mt-2 space-y-2">
                        <li className="flex items-center">
                          <link_1.default href={repo} target="_blank" className="inline-flex items-center space-x-2 truncate text-sm">
                            <span>{(_h = repo === null || repo === void 0 ? void 0 : repo.replace("https://github.com/", "")) === null || _h === void 0 ? void 0 : _h.replace("https://gitlab.com/", "")}</span> <iconoir_react_1.OpenInWindow className="text-xs"/>
                          </link_1.default>
                        </li>
                      </ul>
                    </div>)}
                  {((_j = service.uris) === null || _j === void 0 ? void 0 : _j.length) > 0 && (<>
                      <div className="mt-2">
                        <LabelValueOld_1.LabelValueOld label="URI(s):"/>
                        <ul className="mt-2 space-y-2" aria-label="URIs">
                          {service.uris.map(function (uri) {
                            return (<li className="flex items-center" key={uri}>
                                <link_1.default href={"http://".concat(uri)} target="_blank" className="inline-flex items-center space-x-2 truncate text-sm">
                                  <span>{uri}</span>
                                  <iconoir_react_1.OpenInWindow className="text-xs"/>
                                </link_1.default>
                                &nbsp;&nbsp;
                                <CopyTextToClipboardButton_1.CopyTextToClipboardButton value={uri}/>
                              </li>);
                        })}
                        </ul>
                      </div>
                    </>)}
                </div>);
            })}

          {isLeaseActive && leaseStatus && leaseStatus.ips && (<div className="mt-2">
              <LabelValueOld_1.LabelValueOld label="IP(s):"/>
              <ul className="mt-2 space-y-2">
                {servicesNames
                .flatMap(function (service) { return leaseStatus.ips[service]; })
                .filter(Boolean)
                .map(function (ip) { return (<li key={"".concat(ip.IP).concat(ip.ExternalPort)} className="flex items-center">
                      <link_1.default className="inline-flex items-center space-x-2 text-sm" href={"http://".concat(ip.IP, ":").concat(ip.ExternalPort)} target="_blank">
                        <span>
                          {ip.IP}:{ip.ExternalPort}
                        </span>
                        <iconoir_react_1.OpenInWindow className="text-xs"/>
                      </link_1.default>
                      &nbsp;&nbsp;
                      <components_1.CustomTooltip title={<>
                            <div>IP:&nbsp;{ip.IP}</div>
                            <div>External Port:&nbsp;{ip.ExternalPort}</div>
                            <div>Port:&nbsp;{ip.Port}</div>
                            <div>Protocol:&nbsp;{ip.Protocol}</div>
                          </>}>
                        <iconoir_react_1.InfoCircle className="text-xs text-muted-foreground"/>
                      </components_1.CustomTooltip>
                      <components_1.Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={function () {
                    (0, copyClipboard_1.copyTextToClipboard)("".concat(ip.IP, ":").concat(ip.ExternalPort));
                    enqueueSnackbar(<components_1.Snackbar title="Ip copied to clipboard!" iconVariant="success"/>, {
                        variant: "success",
                        autoHideDuration: 2000
                    });
                }}>
                        <iconoir_react_1.Copy className="text-xs"/>
                      </components_1.Button>
                    </li>); })}
              </ul>
            </div>)}

          {sshInstructions && (<div className="mt-4">
              <h5 className="font-bold dark:text-neutral-500">SSH Instructions:</h5>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  Open a command terminal on your machine and copy this command into it:
                  <CodeSnippet_1.CodeSnippet code={sshInstructions}/>
                </li>
                <li>
                  Replace ~/.ssh/id_rsa with the path to the private key (stored on your local machine) corresponding to the public key you provided earlier
                </li>
                <li>Run the command</li>
              </ul>
            </div>)}
        </components_1.CardContent>
      </components_1.Card>);
});
