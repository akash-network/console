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
exports.useSettings = exports.SettingsProvider = exports.SettingsProviderContext = void 0;
var react_1 = require("react");
var net_1 = require("@akashnetwork/net");
var useLocalStorage_1 = require("@src/hooks/useLocalStorage");
var usePreviousRoute_1 = require("@src/hooks/usePreviousRoute");
var createFetchAdapter_1 = require("@src/services/createFetchAdapter/createFetchAdapter");
var localStorage_1 = require("@src/utils/localStorage");
var RootContainerProvider_1 = require("../ServicesProvider/RootContainerProvider");
exports.SettingsProviderContext = react_1.default.createContext({});
var defaultSettings = {
    apiEndpoint: "",
    rpcEndpoint: "",
    isCustomNode: false,
    nodes: [],
    selectedNode: null,
    customNode: null,
    isBlockchainDown: false
};
var fetchAdapter = (0, createFetchAdapter_1.createFetchAdapter)({
    circuitBreaker: {
        halfOpenAfter: 5 * 1000
    }
});
var SettingsProvider = function (_a) {
    var children = _a.children;
    var _b = (0, RootContainerProvider_1.useRootContainer)(), externalApiHttpClient = _b.externalApiHttpClient, queryClient = _b.queryClient, networkStore = _b.networkStore;
    var _c = (0, react_1.useState)(defaultSettings), settings = _c[0], setSettings = _c[1];
    var _d = (0, react_1.useState)(true), isLoadingSettings = _d[0], setIsLoadingSettings = _d[1];
    var _e = (0, react_1.useState)(false), isSettingsInit = _e[0], setIsSettingsInit = _e[1];
    var _f = (0, react_1.useState)(false), isRefreshingNodeStatus = _f[0], setIsRefreshingNodeStatus = _f[1];
    var _g = (0, useLocalStorage_1.useLocalStorage)(), getLocalStorageItem = _g.getLocalStorageItem, setLocalStorageItem = _g.setLocalStorageItem;
    var isCustomNode = settings.isCustomNode, customNode = settings.customNode, nodes = settings.nodes, apiEndpoint = settings.apiEndpoint, rpcEndpoint = settings.rpcEndpoint;
    var selectedNetwork = networkStore.useSelectedNetwork();
    var isLoadingNetworks = networkStore.useNetworksStore()[0].isLoading;
    (0, usePreviousRoute_1.usePreviousRoute)();
    // load settings from localStorage or set default values
    (0, react_1.useEffect)(function () {
        if (isLoadingNetworks) {
            return;
        }
        var initiateSettings = function () { return __awaiter(void 0, void 0, void 0, function () {
            var settingsStr, settings, nodes, nodesWithStatuses, selectedNodeInSettings, defaultApiNode, defaultRpcNode, selectedNode, nodeStatus, customNodeUrl, customNode_1, randomNode, _a, _b, _c;
            var _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        setIsLoadingSettings(true);
                        // Apply local storage migrations
                        (0, localStorage_1.migrateLocalStorage)();
                        settingsStr = getLocalStorageItem("settings");
                        settings = __assign(__assign({}, defaultSettings), JSON.parse(settingsStr || "{}"));
                        return [4 /*yield*/, externalApiHttpClient.get(selectedNetwork.nodesUrl)];
                    case 1:
                        nodes = (_g.sent()).data;
                        return [4 /*yield*/, Promise.all(nodes.map(function (node) { return __awaiter(void 0, void 0, void 0, function () {
                                var nodeStatus;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, loadNodeStatus(node.rpc)];
                                        case 1:
                                            nodeStatus = _a.sent();
                                            return [2 /*return*/, __assign(__assign({}, node), { status: nodeStatus.status, latency: nodeStatus.latency, nodeInfo: nodeStatus.nodeInfo })];
                                    }
                                });
                            }); }))];
                    case 2:
                        nodesWithStatuses = _g.sent();
                        selectedNodeInSettings = settingsStr && settings.apiEndpoint && settings.rpcEndpoint && settings.selectedNode ? nodes === null || nodes === void 0 ? void 0 : nodes.find(function (x) { var _a; return x.id === ((_a = settings.selectedNode) === null || _a === void 0 ? void 0 : _a.id); }) : undefined;
                        defaultApiNode = (_d = selectedNodeInSettings === null || selectedNodeInSettings === void 0 ? void 0 : selectedNodeInSettings.api) !== null && _d !== void 0 ? _d : settings.apiEndpoint;
                        defaultRpcNode = (_e = selectedNodeInSettings === null || selectedNodeInSettings === void 0 ? void 0 : selectedNodeInSettings.rpc) !== null && _e !== void 0 ? _e : settings.rpcEndpoint;
                        selectedNode = selectedNodeInSettings || settings.selectedNode;
                        if (!settings.isCustomNode) return [3 /*break*/, 4];
                        return [4 /*yield*/, loadNodeStatus(settings.rpcEndpoint)];
                    case 3:
                        nodeStatus = _g.sent();
                        customNodeUrl = new URL(settings.apiEndpoint);
                        customNode_1 = {
                            api: "",
                            rpc: "",
                            status: nodeStatus.status,
                            latency: nodeStatus.latency,
                            nodeInfo: nodeStatus.nodeInfo,
                            id: customNodeUrl.hostname
                        };
                        updateSettings(__assign(__assign({}, settings), { apiEndpoint: defaultApiNode, rpcEndpoint: defaultRpcNode, selectedNode: selectedNode, customNode: customNode_1, nodes: nodesWithStatuses, isBlockchainDown: nodeStatus.status === "inactive" }));
                        _g.label = 4;
                    case 4:
                        if (!(!selectedNodeInSettings || (selectedNodeInSettings && ((_f = settings.selectedNode) === null || _f === void 0 ? void 0 : _f.status) === "inactive"))) return [3 /*break*/, 7];
                        randomNode = getFastestNode(nodesWithStatuses);
                        // Use rpc proxy as a backup if there's no active nodes in the list
                        defaultApiNode = (randomNode === null || randomNode === void 0 ? void 0 : randomNode.api) || net_1.netConfig.getBaseAPIUrl(net_1.netConfig.mapped(selectedNetwork.id));
                        defaultRpcNode = (randomNode === null || randomNode === void 0 ? void 0 : randomNode.rpc) || net_1.netConfig.getBaseRpcUrl(net_1.netConfig.mapped(selectedNetwork.id));
                        selectedNode = randomNode || {
                            api: defaultApiNode,
                            rpc: defaultRpcNode,
                            status: "active",
                            latency: 0,
                            nodeInfo: null,
                            id: net_1.netConfig.mapped(selectedNetwork.id)
                        };
                        if (!(selectedNode.nodeInfo === null)) return [3 /*break*/, 6];
                        _b = (_a = Object).assign;
                        _c = [selectedNode];
                        return [4 /*yield*/, loadNodeStatus(selectedNode.api)];
                    case 5:
                        _b.apply(_a, _c.concat([_g.sent()]));
                        _g.label = 6;
                    case 6:
                        updateSettings(__assign(__assign({}, settings), { apiEndpoint: defaultApiNode, rpcEndpoint: defaultRpcNode, selectedNode: selectedNode, nodes: nodesWithStatuses, isBlockchainDown: selectedNode.status === "inactive" }));
                        return [3 /*break*/, 8];
                    case 7:
                        defaultApiNode = settings.apiEndpoint;
                        defaultRpcNode = settings.rpcEndpoint;
                        selectedNode = settings.selectedNode;
                        updateSettings(__assign(__assign({}, settings), { apiEndpoint: defaultApiNode, rpcEndpoint: defaultRpcNode, selectedNode: selectedNode, nodes: nodesWithStatuses, isBlockchainDown: false }));
                        _g.label = 8;
                    case 8:
                        setIsLoadingSettings(false);
                        setIsSettingsInit(true);
                        return [2 /*return*/];
                }
            });
        }); };
        initiateSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoadingNetworks]);
    /**
     * Load the node status from status rpc endpoint
     * @param {string} rpcUrl
     * @returns
     */
    var loadNodeStatus = function (rpcUrl) { return __awaiter(void 0, void 0, void 0, function () {
        var start, status, nodeStatus, response, error_1, end, latency;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    start = performance.now();
                    status = "inactive";
                    nodeStatus = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, externalApiHttpClient.get("".concat(rpcUrl, "/status"), {
                            timeout: 5000,
                            adapter: fetchAdapter,
                            "axios-retry": {
                                retries: 0
                            }
                        })];
                case 2:
                    response = _a.sent();
                    nodeStatus = response.data.result;
                    status = "active";
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    status = "inactive";
                    return [3 /*break*/, 4];
                case 4:
                    end = performance.now();
                    latency = end - start;
                    return [2 /*return*/, {
                            latency: latency,
                            status: status,
                            nodeInfo: nodeStatus
                        }];
            }
        });
    }); };
    /**
     * Get the fastest node from the list based on latency
     */
    var getFastestNode = function (nodes) {
        var healthyNodes = nodes.filter(function (n) { var _a; return n.status === "active" && ((_a = n.nodeInfo) === null || _a === void 0 ? void 0 : _a.sync_info.catching_up) === false; });
        if (healthyNodes.length === 0)
            return;
        return healthyNodes.reduce(function (fastestNode, node) { return (node.latency < fastestNode.latency ? node : fastestNode); });
    };
    var updateSettings = function (value) {
        setSettings(function (prevSettings) {
            var newSettings = typeof value === "function" ? value(prevSettings) : value;
            clearQueries(prevSettings, newSettings);
            setLocalStorageItem("settings", JSON.stringify(newSettings));
            return newSettings;
        });
    };
    var clearQueries = function (prevSettings, newSettings) {
        if (prevSettings.apiEndpoint !== newSettings.apiEndpoint || (prevSettings.isCustomNode && !newSettings.isCustomNode)) {
            // Cancel and remove queries from cache if the api endpoint is changed
            queryClient.resetQueries();
            queryClient.cancelQueries();
            queryClient.removeQueries();
            queryClient.clear();
        }
    };
    /**
     * Refresh the nodes status and latency
     * @returns
     */
    var refreshNodeStatuses = (0, react_1.useCallback)(function (settingsOverride) { return __awaiter(void 0, void 0, void 0, function () {
        var _nodes, _customNode, _isCustomNode, _apiEndpoint, _rpcEndpoint, nodeStatus, customNodeUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isRefreshingNodeStatus)
                        return [2 /*return*/];
                    setIsRefreshingNodeStatus(true);
                    _nodes = settingsOverride ? settingsOverride.nodes : nodes;
                    _customNode = settingsOverride ? settingsOverride.customNode : customNode;
                    _isCustomNode = settingsOverride ? settingsOverride.isCustomNode : isCustomNode;
                    _apiEndpoint = settingsOverride ? settingsOverride.apiEndpoint : apiEndpoint;
                    _rpcEndpoint = settingsOverride ? settingsOverride.rpcEndpoint : rpcEndpoint;
                    if (!_isCustomNode) return [3 /*break*/, 2];
                    return [4 /*yield*/, loadNodeStatus(_rpcEndpoint)];
                case 1:
                    nodeStatus = _a.sent();
                    customNodeUrl = new URL(_apiEndpoint);
                    _customNode = {
                        status: nodeStatus.status,
                        latency: nodeStatus.latency,
                        nodeInfo: nodeStatus.nodeInfo,
                        id: customNodeUrl.hostname,
                        api: _apiEndpoint,
                        rpc: _rpcEndpoint
                    };
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, Promise.all(_nodes.map(function (node) { return __awaiter(void 0, void 0, void 0, function () {
                        var nodeStatus;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, loadNodeStatus(node.rpc)];
                                case 1:
                                    nodeStatus = _a.sent();
                                    return [2 /*return*/, __assign(__assign({}, node), { status: nodeStatus.status, latency: nodeStatus.latency, nodeInfo: nodeStatus.nodeInfo })];
                            }
                        });
                    }); }))];
                case 3:
                    _nodes = _a.sent();
                    _a.label = 4;
                case 4:
                    setIsRefreshingNodeStatus(false);
                    // Update the settings with callback to avoid stale state settings
                    updateSettings(function (prevSettings) {
                        var selectedNode = prevSettings.selectedNode ? _nodes.find(function (node) { var _a; return node.id === ((_a = prevSettings.selectedNode) === null || _a === void 0 ? void 0 : _a.id); }) : undefined;
                        var isBlockchainDown;
                        if (_isCustomNode) {
                            isBlockchainDown = (_customNode === null || _customNode === void 0 ? void 0 : _customNode.status) === "inactive";
                        }
                        else {
                            isBlockchainDown = selectedNode ? selectedNode.status === "inactive" : _nodes.every(function (node) { return node.status === "inactive"; });
                        }
                        return __assign(__assign({}, prevSettings), { nodes: _nodes, selectedNode: selectedNode, customNode: _customNode, isCustomNode: _isCustomNode, isBlockchainDown: isBlockchainDown });
                    });
                    return [2 /*return*/];
            }
        });
    }); }, [isCustomNode, isRefreshingNodeStatus, customNode, setLocalStorageItem, apiEndpoint, nodes, setSettings]);
    return (<exports.SettingsProviderContext.Provider value={{
            settings: settings,
            setSettings: updateSettings,
            isLoadingSettings: isLoadingSettings,
            refreshNodeStatuses: refreshNodeStatuses,
            isRefreshingNodeStatus: isRefreshingNodeStatus,
            isSettingsInit: isSettingsInit
        }}>
      {children}
    </exports.SettingsProviderContext.Provider>);
};
exports.SettingsProvider = SettingsProvider;
var useSettings = function () {
    return __assign({}, react_1.default.useContext(exports.SettingsProviderContext));
};
exports.useSettings = useSettings;
