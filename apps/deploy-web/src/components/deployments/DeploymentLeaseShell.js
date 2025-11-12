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
exports.DeploymentLeaseShell = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var ViewPanel_1 = require("@src/components/shared/ViewPanel");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useProviderCredentials_1 = require("@src/hooks/useProviderCredentials/useProviderCredentials");
var XTerm_1 = require("@src/lib/XTerm");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var shell_1 = require("@src/types/shell");
var array_1 = require("@src/utils/array");
var urlUtils_1 = require("@src/utils/urlUtils");
var CreateCredentialsButton_1 = require("./CreateCredentialsButton/CreateCredentialsButton");
var LeaseSelect_1 = require("./LeaseSelect");
var ServiceSelect_1 = require("./ServiceSelect");
var ShellDownloadModal_1 = require("./ShellDownloadModal");
var textDecoder = new TextDecoder("utf-8");
var DeploymentLeaseShell = function (_a) {
    var _b;
    var leases = _a.leases;
    var _c = (0, ServicesProvider_1.useServices)(), providerProxy = _c.providerProxy, networkStore = _c.networkStore, errorHandler = _c.errorHandler;
    var _d = (0, react_1.useState)(false), isConnectionEstablished = _d[0], setIsConnectionEstablished = _d[1];
    var _e = (0, react_1.useState)(true), isLoadingData = _e[0], setIsLoadingData = _e[1];
    var _f = (0, react_1.useState)(false), isConnectionClosed = _f[0], setIsConnectionClosed = _f[1];
    var _g = (0, react_1.useState)(null), selectedService = _g[0], setSelectedService = _g[1];
    var _h = (0, react_1.useState)(null), selectedLease = _h[0], setSelectedLease = _h[1];
    var _j = (0, react_1.useState)(false), isShowingDownloadModal = _j[0], setIsShowingDownloadModal = _j[1];
    var _k = (0, react_1.useState)(false), isChangingSocket = _k[0], setIsChangingSocket = _k[1];
    var _l = (0, react_1.useState)(false), showArrowAndTabWarning = _l[0], setShowArrowAndTabWarning = _l[1];
    var providers = (0, useProvidersQuery_1.useProviderList)().data;
    var providerCredentials = (0, useProviderCredentials_1.useProviderCredentials)();
    var providerInfo = providers === null || providers === void 0 ? void 0 : providers.find(function (p) { return p.owner === (selectedLease === null || selectedLease === void 0 ? void 0 : selectedLease.provider); });
    var _m = (0, useLeaseQuery_1.useLeaseStatus)({
        provider: providerInfo,
        lease: selectedLease,
        enabled: false
    }), leaseStatus = _m.data, getLeaseStatus = _m.refetch, isLoadingStatus = _m.isFetching;
    var terminalRef = (0, react_1.useRef)(null);
    var isConnectionEstablishedRef = (0, react_1.useRef)(false);
    var services = (0, react_1.useMemo)(function () { return (leaseStatus ? Object.keys(leaseStatus.services) : []); }, [leaseStatus]);
    (0, react_1.useEffect)(function () {
        if (leaseStatus) {
            // Set the first service as default
            setSelectedService(Object.keys(leaseStatus.services)[0]);
        }
    }, [leaseStatus]);
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
    var shellSession = (0, react_1.useMemo)(function () {
        if (!providerInfo || !providerCredentials.details.usable || !selectedLease || !selectedService)
            return null;
        var abortController = new AbortController();
        var conn = providerProxy.connectToShell({
            providerBaseUrl: providerInfo.hostUri,
            providerAddress: providerInfo.owner,
            providerCredentials: providerCredentials.details,
            dseq: selectedLease.dseq,
            gseq: selectedLease.gseq,
            oseq: selectedLease.oseq,
            chainNetwork: networkStore.selectedNetworkId,
            service: selectedService,
            useStdIn: true,
            useTTY: true,
            signal: abortController.signal
        });
        return {
            conn: conn,
            abortController: abortController
        };
    }, [providerInfo, providerCredentials.details, selectedLease, selectedService]);
    (0, react_1.useEffect)(function () {
        if (!shellSession)
            return;
        setIsLoadingData(true);
        shellSession.conn.send(new Uint8Array());
        (0, array_1.forEachGeneratedItem)(shellSession.conn.receive(), onCommandResponseReceived).catch(function (error) {
            errorHandler.reportError({
                error: error,
                tags: { category: "deployments", label: "DeploymentLeaseShell" }
            });
        });
        return function () { return shellSession.abortController.abort(); };
    }, [shellSession]);
    function onCommandResponseReceived(jsonData) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        var message = jsonData === null || jsonData === void 0 ? void 0 : jsonData.message;
        var error = jsonData === null || jsonData === void 0 ? void 0 : jsonData.error;
        var closed = jsonData === null || jsonData === void 0 ? void 0 : jsonData.closed;
        if (message === null || message === void 0 ? void 0 : message.data) {
            var parsedData = textDecoder.decode(Uint8Array.from(message.data.slice(1)));
            // Check if parsedData is either ^[[A, ^[[B, ^[[C or ^[[D
            var arrowKeyPattern = /\^\[\[[A-D]/;
            if (arrowKeyPattern.test(parsedData)) {
                setShowArrowAndTabWarning(true);
            }
            var exitCode = void 0;
            try {
                var jsonData_1 = JSON.parse(parsedData);
                exitCode = jsonData_1["exit_code"];
            }
            catch (error) {
                /* empty */
            }
            if (exitCode === undefined) {
                if (!isConnectionEstablishedRef.current) {
                    // Welcome message
                    (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.reset();
                    (_b = terminalRef.current) === null || _b === void 0 ? void 0 : _b.write("Welcome to Akash Console Shell! ☁️");
                    (_c = terminalRef.current) === null || _c === void 0 ? void 0 : _c.write("\n\r");
                    (_d = terminalRef.current) === null || _d === void 0 ? void 0 : _d.write("You're now connected just as ssh to your docker instance.");
                    (_e = terminalRef.current) === null || _e === void 0 ? void 0 : _e.write("\n\r");
                    (_f = terminalRef.current) === null || _f === void 0 ? void 0 : _f.write("\n\r");
                    (_g = terminalRef.current) === null || _g === void 0 ? void 0 : _g.focus();
                    isConnectionEstablishedRef.current = true;
                }
                (_h = terminalRef.current) === null || _h === void 0 ? void 0 : _h.write(parsedData);
                // Reset state
                setIsConnectionEstablished(true);
                setIsConnectionClosed(false);
                setIsChangingSocket(false);
                setIsLoadingData(false);
            }
        }
        if (error) {
            (_j = terminalRef.current) === null || _j === void 0 ? void 0 : _j.write(error);
            setIsLoadingData(false);
        }
        if (closed && !isChangingSocket) {
            setIsConnectionClosed(true);
            setIsLoadingData(false);
            setIsChangingSocket(false);
        }
    }
    var getEncodedData = function (data) {
        // Data needs to be sent as a byte array
        var encoder = new TextEncoder();
        var _data = encoder.encode(data);
        var content = new Uint8Array(_data.length + 1);
        var stdin = new Uint8Array([shell_1.LeaseShellCode.LeaseShellCodeStdin]);
        // Set first byte as Stdin code
        content.set(stdin);
        // Set the rest of the bytes of the input
        content.set(_data, 1);
        return content;
    };
    var onTerminalKey = (0, react_1.useCallback)(function (event) {
        var data = getEncodedData(event.key);
        shellSession === null || shellSession === void 0 ? void 0 : shellSession.conn.send(data);
    }, [shellSession]);
    var onTerminalPaste = (0, react_1.useCallback)(function (value) {
        var data = getEncodedData(value);
        shellSession === null || shellSession === void 0 ? void 0 : shellSession.conn.send(data);
    }, [shellSession]);
    function handleLeaseChange(id) {
        var _a;
        setSelectedLease((leases === null || leases === void 0 ? void 0 : leases.find(function (x) { return x.id === id; })) || null);
        if (id !== (selectedLease === null || selectedLease === void 0 ? void 0 : selectedLease.id)) {
            // Clear terminal
            (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.reset();
            setIsChangingSocket(true);
            setSelectedService(null);
            setIsConnectionEstablished(false);
            isConnectionEstablishedRef.current = false;
        }
    }
    var onSelectedServiceChange = function (value) {
        var _a;
        setSelectedService(value);
        if (value !== selectedService) {
            // Clear terminal
            (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.reset();
            setIsChangingSocket(true);
            setIsConnectionEstablished(false);
            isConnectionEstablishedRef.current = false;
        }
    };
    var onDownloadFileClick = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setIsShowingDownloadModal(true);
            return [2 /*return*/];
        });
    }); };
    var onCloseDownloadClick = function () {
        // setIsDownloadingFile(false);
        setIsShowingDownloadModal(false);
    };
    return (<div>
      {isShowingDownloadModal && selectedLease && providerInfo && selectedService && (<ShellDownloadModal_1.ShellDownloadModal onCloseClick={onCloseDownloadClick} selectedLease={selectedLease} providerInfo={providerInfo} selectedService={selectedService}/>)}

      {providerCredentials.details.usable ? (<>
          {selectedLease && (<>
              <div className="flex h-[56px] items-center space-x-4 p-2">
                <div className="flex items-center">
                  {((leases === null || leases === void 0 ? void 0 : leases.length) || 0) > 1 && <LeaseSelect_1.LeaseSelect leases={leases || []} defaultValue={selectedLease.id} onSelectedChange={handleLeaseChange}/>}

                  {(services === null || services === void 0 ? void 0 : services.length) > 0 && selectedService && (<div className={(0, utils_1.cn)((_b = {}, _b["ml-2"] = ((leases === null || leases === void 0 ? void 0 : leases.length) || 0) > 1, _b))}>
                      <ServiceSelect_1.ServiceSelect services={services} defaultValue={selectedService} onSelectedChange={onSelectedServiceChange}/>
                    </div>)}
                </div>

                <div className="flex items-center">
                  <components_1.Button onClick={onDownloadFileClick} variant="default" size="sm" disabled={!isConnectionEstablished}>
                    Download file
                  </components_1.Button>
                </div>

                {(isLoadingStatus || isLoadingData) && (<div>
                    <components_1.Spinner size="small"/>
                  </div>)}
              </div>

              {showArrowAndTabWarning && (<components_1.Alert variant="warning" className="mb-1 rounded-none">
                  <link_1.default href={urlUtils_1.UrlService.faq("shell-arrows-and-completion")} target="_blank" className="inline-flex items-center space-x-2">
                    <span>Why is my UP arrow and TAB autocompletion not working?</span>
                    <iconoir_react_1.OpenInWindow className="text-xs"/>
                  </link_1.default>
                </components_1.Alert>)}

              <ViewPanel_1.default stickToBottom className="overflow-hidden">
                {isConnectionClosed && (<components_1.Alert variant="warning" className="rounded-none">
                    The connection to your Akash Console Shell was not established or lost.
                  </components_1.Alert>)}
                <XTerm_1.XTerm ref={terminalRef} onKey={onTerminalKey} onTerminalPaste={onTerminalPaste}/>
              </ViewPanel_1.default>
            </>)}
        </>) : (<CreateCredentialsButton_1.CreateCredentialsButton containerClassName="py-4"/>)}
    </div>);
};
exports.DeploymentLeaseShell = DeploymentLeaseShell;
