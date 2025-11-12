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
exports.DeploymentLogs = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var styles_1 = require("@mui/material/styles");
var useMediaQuery_1 = require("@mui/material/useMediaQuery");
var iconoir_react_1 = require("iconoir-react");
var CustomDropdownLinkItem_1 = require("@src/components/shared/CustomDropdownLinkItem");
var LinearLoadingSkeleton_1 = require("@src/components/shared/LinearLoadingSkeleton");
var MemoMonaco_1 = require("@src/components/shared/MemoMonaco");
var SelectCheckbox_1 = require("@src/components/shared/SelectCheckbox");
var ViewPanel_1 = require("@src/components/shared/ViewPanel");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useProviderApiActions_1 = require("@src/hooks/useProviderApiActions");
var useProviderCredentials_1 = require("@src/hooks/useProviderCredentials/useProviderCredentials");
var useThrottle_1 = require("@src/hooks/useThrottle");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var logFormatters_1 = require("@src/services/provider-proxy/logFormatters");
var array_1 = require("@src/utils/array");
var CreateCredentialsButton_1 = require("./CreateCredentialsButton/CreateCredentialsButton");
var LeaseSelect_1 = require("./LeaseSelect");
var DeploymentLogs = function (_a) {
    var _b;
    var leases = _a.leases, selectedLogsMode = _a.selectedLogsMode;
    var _c = (0, ServicesProvider_1.useServices)(), analyticsService = _c.analyticsService, providerProxy = _c.providerProxy, networkStore = _c.networkStore, errorHandler = _c.errorHandler;
    var _d = (0, react_1.useState)(true), isLoadingLogs = _d[0], setIsLoadingLogs = _d[1];
    var _e = (0, react_1.useState)(false), isConnectionEstablished = _e[0], setIsConnectionEstablished = _e[1];
    // TODO Type
    var logs = (0, react_1.useRef)([]);
    var _f = (0, react_1.useState)(""), logText = _f[0], setLogText = _f[1];
    var _g = (0, react_1.useState)(false), isDownloadingLogs = _g[0], setIsDownloadingLogs = _g[1];
    var _h = (0, react_1.useState)([]), selectedServices = _h[0], setSelectedServices = _h[1];
    var _j = (0, react_1.useState)(true), stickToBottom = _j[0], setStickToBottom = _j[1];
    var _k = (0, react_1.useState)(null), selectedLease = _k[0], setSelectedLease = _k[1];
    var providers = (0, useProvidersQuery_1.useProviderList)().data;
    var providerCredentials = (0, useProviderCredentials_1.useProviderCredentials)();
    var downloadLogs = (0, useProviderApiActions_1.useProviderApiActions)().downloadLogs;
    var monacoEditorRef = (0, react_1.useRef)(null);
    var monacoRef = (0, react_1.useRef)(null);
    var providerInfo = providers === null || providers === void 0 ? void 0 : providers.find(function (p) { return p.owner === (selectedLease === null || selectedLease === void 0 ? void 0 : selectedLease.provider); });
    var _l = (0, useLeaseQuery_1.useLeaseStatus)({
        provider: providerInfo,
        lease: selectedLease,
        enabled: false
    }), leaseStatus = _l.data, getLeaseStatus = _l.refetch, isLoadingStatus = _l.isFetching;
    var services = (0, react_1.useMemo)(function () { return (leaseStatus ? Object.keys(leaseStatus.services) : []); }, [leaseStatus]);
    var muiTheme = (0, styles_1.useTheme)();
    var smallScreen = (0, useMediaQuery_1.default)(muiTheme.breakpoints.down("md"));
    function handleEditorDidMount(editor, monaco) {
        // here is another way to get monaco instance
        // you can also store it in `useRef` for further usage
        monacoEditorRef.current = editor;
        monacoRef.current = monaco;
    }
    (0, react_1.useEffect)(function () {
        if (monacoEditorRef.current) {
            var editor_1 = monacoEditorRef.current;
            editor_1.onDidScrollChange(function (event) {
                // TODO Verify
                if (event.scrollTop < event._oldScrollTop) {
                    setStickToBottom(false);
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [monacoEditorRef.current]);
    (0, react_1.useEffect)(function () {
        if (leaseStatus) {
            setSelectedServices(Object.keys(leaseStatus.services));
        }
        else {
            setSelectedServices([]);
        }
    }, [leaseStatus]);
    var updateLogText = (0, useThrottle_1.useThrottledCallback)(function () {
        var logText = logs.current.join("\n");
        setLogText(logText);
        setIsLoadingLogs(false);
    }, [], 1000);
    (0, react_1.useEffect)(function () {
        if (!leases || leases.length === 0)
            return;
        setSelectedLease(leases[0]);
    }, [leases]);
    (0, react_1.useEffect)(function () {
        if (!selectedLease || !providerInfo)
            return;
        getLeaseStatus();
    }, [selectedLease, providerInfo, getLeaseStatus]);
    (0, react_1.useEffect)(function () {
        if (!providerInfo || !providerCredentials.details.usable || !selectedLease || !(services === null || services === void 0 ? void 0 : services.length) || !(selectedServices === null || selectedServices === void 0 ? void 0 : selectedServices.length))
            return;
        logs.current = [];
        setIsLoadingLogs(true);
        var abortController = new AbortController();
        (0, array_1.forEachGeneratedItem)(providerProxy.getLogsStream({
            providerBaseUrl: providerInfo.hostUri,
            providerAddress: providerInfo.owner,
            providerCredentials: providerCredentials.details,
            dseq: selectedLease.dseq,
            gseq: selectedLease.gseq,
            oseq: selectedLease.oseq,
            type: selectedLogsMode,
            follow: true,
            chainNetwork: networkStore.selectedNetworkId,
            services: selectedServices.length < services.length ? selectedServices : undefined,
            signal: abortController.signal
        }), onLogReceived).catch(function (error) {
            errorHandler.reportError({
                error: error,
                tags: { category: "deployments", label: "followLogs" }
            });
        });
        return function () {
            abortController.abort();
        };
    }, [providerCredentials.details, selectedLogsMode, selectedLease, selectedServices, services === null || services === void 0 ? void 0 : services.length, providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.owner, providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.hostUri]);
    function onLogReceived(proxyMessage) {
        if (proxyMessage.closed)
            return;
        var message = proxyMessage.message;
        setIsLoadingLogs(true);
        if (logs.current.length === 0) {
            setStickToBottom(true);
        }
        var logMessage = selectedLogsMode === "logs" ? (0, logFormatters_1.formatLogMessage)(message) : (0, logFormatters_1.formatK8sEvent)(message);
        logs.current = logs.current.concat(logMessage);
        updateLogText();
        setIsConnectionEstablished(true);
    }
    (0, react_1.useEffect)(function () {
        var _a;
        if (stickToBottom && monacoEditorRef.current && monacoRef.current) {
            var editor_2 = monacoEditorRef.current;
            var monaco = monacoRef.current;
            // Immediate scroll type, scroll to bottom
            editor_2.revealLine(((_a = editor_2.getModel()) === null || _a === void 0 ? void 0 : _a.getLineCount()) || 0, 1);
            // Clear selection
            editor_2.setSelection(new monaco.Selection(0, 0, 0, 0));
        }
    }, [logText, stickToBottom]);
    function handleLeaseChange(id) {
        setSelectedLease((leases === null || leases === void 0 ? void 0 : leases.find(function (x) { return x.id === id; })) || null);
        if (id !== (selectedLease === null || selectedLease === void 0 ? void 0 : selectedLease.id)) {
            setLogText("");
            setSelectedServices([]);
            setIsLoadingLogs(true);
            setIsConnectionEstablished(false);
        }
    }
    var onSelectedServicesChange = function (selected) {
        setSelectedServices(selected);
        setLogText("");
        setIsLoadingLogs(selected.length > 0);
        setIsConnectionEstablished(selected.length === 0);
    };
    var onDownloadLogsClick = function () { return __awaiter(void 0, void 0, void 0, function () {
        var isLogs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(!isDownloadingLogs && providerInfo && selectedLease)) return [3 /*break*/, 2];
                    setIsDownloadingLogs(true);
                    isLogs = selectedLogsMode === "logs";
                    return [4 /*yield*/, downloadLogs(providerInfo, selectedLease.dseq, selectedLease.gseq, selectedLease.oseq, isLogs)];
                case 1:
                    _a.sent();
                    analyticsService.track("downloaded_logs", {
                        category: "deployments",
                        label: isLogs ? "Downloaded deployment logs" : "Downloaded deployment events"
                    });
                    setIsDownloadingLogs(false);
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); };
    return (<div>
      {providerCredentials.details.usable ? (<>
          {selectedLease && (<>
              <div className="flex h-[56px] items-center space-x-4 p-2">
                <div className="flex items-center">
                  {((leases === null || leases === void 0 ? void 0 : leases.length) || 0) > 1 && <LeaseSelect_1.LeaseSelect leases={leases || []} defaultValue={selectedLease.id} onSelectedChange={handleLeaseChange}/>}

                  {(services === null || services === void 0 ? void 0 : services.length) > 0 && (<div className={(0, utils_1.cn)((_b = {}, _b["ml-2"] = ((leases === null || leases === void 0 ? void 0 : leases.length) || 0) > 1, _b))}>
                      <SelectCheckbox_1.SelectCheckbox options={services} selected={selectedServices} onSelectedChange={onSelectedServicesChange} label="Services" placeholder="Select services" disabled={selectedLogsMode !== "logs"}/>
                    </div>)}
                </div>

                {smallScreen ? (<div>
                    <components_1.DropdownMenu modal={false}>
                      <components_1.DropdownMenuTrigger asChild>
                        <components_1.Button size="icon" variant="ghost" className="rounded-full">
                          <iconoir_react_1.MoreHoriz className="text-xs"/>
                        </components_1.Button>
                      </components_1.DropdownMenuTrigger>
                      <components_1.DropdownMenuContent align="end">
                        <CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                          <div className="flex items-center space-x-2">
                            <components_1.Checkbox checked={stickToBottom} onCheckedChange={function (checked) { return setStickToBottom(checked); }} id="stick-bottom"/>
                            <label htmlFor="stick-bottom" className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Stick to bottom
                            </label>
                          </div>
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                        <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={onDownloadLogsClick} icon={isDownloadingLogs ? <components_1.Spinner /> : <iconoir_react_1.Download />} disabled={isDownloadingLogs}>
                          {selectedLogsMode === "logs" ? "Download logs" : "Download events"}
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                      </components_1.DropdownMenuContent>
                    </components_1.DropdownMenu>
                  </div>) : (<div className="flex items-center">
                    <components_1.CheckboxWithLabel label="Stick to bottom" checked={stickToBottom} onCheckedChange={function (checked) { return setStickToBottom(checked); }}/>
                    <div className="ml-4">
                      <components_1.Button onClick={onDownloadLogsClick} variant="default" size="sm" color="secondary" disabled={isDownloadingLogs || !isConnectionEstablished}>
                        {isDownloadingLogs ? <components_1.Spinner size="small"/> : selectedLogsMode === "logs" ? "Download logs" : "Download events"}
                      </components_1.Button>
                    </div>
                  </div>)}

                {isLoadingStatus && (<div>
                    <components_1.Spinner size="small"/>
                  </div>)}
              </div>

              <LinearLoadingSkeleton_1.LinearLoadingSkeleton isLoading={isLoadingLogs}/>

              <ViewPanel_1.default stickToBottom style={{ overflow: "hidden" }}>
                <MemoMonaco_1.MemoMonaco value={logText} onMount={handleEditorDidMount} options={{
                    readOnly: true
                }}/>
              </ViewPanel_1.default>
            </>)}
        </>) : (<CreateCredentialsButton_1.CreateCredentialsButton containerClassName="py-4"/>)}
    </div>);
};
exports.DeploymentLogs = DeploymentLogs;
