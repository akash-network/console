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
exports.DeploymentList = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var next_seo_1 = require("next-seo");
var LinkTo_1 = require("@src/components/shared/LinkTo");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useListSelection_1 = require("@src/hooks/useListSelection/useListSelection");
var useManagedDeploymentConfirm_1 = require("@src/hooks/useManagedDeploymentConfirm");
var useDeploymentQuery_1 = require("@src/queries/useDeploymentQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var sdlStore_1 = require("@src/store/sdlStore");
var walletStore_1 = require("@src/store/walletStore");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var Title_1 = require("../shared/Title");
var ConnectWalletButton_1 = require("../wallet/ConnectWalletButton");
var DeploymentListRow_1 = require("./DeploymentListRow");
var DeploymentList = function () {
    var _a = (0, WalletProvider_1.useWallet)(), address = _a.address, signAndBroadcastTx = _a.signAndBroadcastTx, isWalletLoaded = _a.isWalletLoaded, isWalletConnected = _a.isWalletConnected;
    var _b = (0, useProvidersQuery_1.useProviderList)(), providers = _b.data, isLoadingProviders = _b.isFetching;
    var _c = (0, useDeploymentQuery_1.useDeploymentList)(address, { enabled: false }), deployments = _c.data, isLoadingDeployments = _c.isFetching, getDeployments = _c.refetch;
    var _d = (0, react_1.useState)(0), pageIndex = _d[0], setPageIndex = _d[1];
    var _e = (0, SettingsProvider_1.useSettings)(), settings = _e.settings, isSettingsInit = _e.isSettingsInit;
    var _f = (0, react_1.useState)(""), search = _f[0], setSearch = _f[1];
    var getDeploymentName = (0, LocalNoteProvider_1.useLocalNotes)().getDeploymentName;
    var _g = (0, react_1.useState)(null), filteredDeployments = _g[0], setFilteredDeployments = _g[1];
    var _h = (0, react_1.useState)(true), isFilteringActive = _h[0], setIsFilteringActive = _h[1];
    var apiEndpoint = settings.apiEndpoint;
    var _j = (0, react_1.useState)(10), pageSize = _j[0], setPageSize = _j[1];
    var orderedDeployments = filteredDeployments
        ? __spreadArray([], filteredDeployments, true).sort(function (a, b) { return (a.createdAt < b.createdAt ? 1 : -1); })
        : [];
    var start = pageIndex * pageSize;
    var end = start + pageSize;
    var currentPageDeployments = orderedDeployments.slice(start, end);
    var pageCount = Math.ceil(orderedDeployments.length / pageSize);
    var _k = (0, jotai_1.useAtom)(sdlStore_1.default.deploySdl), setDeploySdl = _k[1];
    var closeDeploymentConfirm = (0, useManagedDeploymentConfirm_1.useManagedDeploymentConfirm)().closeDeploymentConfirm;
    var isSignedInWithTrial = (0, jotai_1.useAtom)(walletStore_1.default.isSignedInWithTrial)[0];
    var user = (0, useCustomUser_1.useCustomUser)().user;
    var _l = (0, useListSelection_1.useListSelection)({
        ids: currentPageDeployments.map(function (deployment) { return deployment.dseq; })
    }), selectedItemIds = _l.selectedItemIds, selectItem = _l.selectItem, clearSelection = _l.clearSelection;
    (0, react_1.useEffect)(function () {
        if (isWalletLoaded && isSettingsInit) {
            getDeployments();
        }
    }, [isWalletLoaded, isSettingsInit, getDeployments, apiEndpoint, address]);
    (0, react_1.useEffect)(function () {
        if (deployments) {
            var filteredDeployments_1 = deployments.map(function (d) {
                var name = getDeploymentName(d.dseq);
                return __assign(__assign({}, d), { name: name });
            });
            // Filter for search
            if (search) {
                filteredDeployments_1 = filteredDeployments_1.filter(function (x) { var _a, _b; return ((_a = x.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(search.toLowerCase())) || ((_b = x.dseq) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(search.toLowerCase())); });
            }
            if (isFilteringActive) {
                filteredDeployments_1 = filteredDeployments_1.filter(function (d) { return d.state === "active"; });
            }
            setFilteredDeployments(filteredDeployments_1);
        }
    }, [deployments, search, getDeploymentName, isFilteringActive]);
    var handleChangePage = function (newPage) {
        setPageIndex(newPage);
    };
    var onIsFilteringActiveClick = function (value) {
        setPageIndex(0);
        setIsFilteringActive(value);
    };
    var onSearchChange = function (event) {
        var value = event.target.value;
        setSearch(value);
    };
    var onCloseSelectedDeployments = function () { return __awaiter(void 0, void 0, void 0, function () {
        var isConfirmed, messages, response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, closeDeploymentConfirm(selectedItemIds)];
                case 1:
                    isConfirmed = _a.sent();
                    if (!isConfirmed) {
                        return [2 /*return*/];
                    }
                    messages = selectedItemIds.map(function (dseq) { return TransactionMessageData_1.TransactionMessageData.getCloseDeploymentMsg(address, "".concat(dseq)); });
                    return [4 /*yield*/, signAndBroadcastTx(messages)];
                case 2:
                    response = _a.sent();
                    if (response) {
                        getDeployments();
                        clearSelection();
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.log(error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var onDeployClick = function () {
        setDeploySdl(null);
    };
    var onPageSizeChange = function (value) {
        setPageSize(value);
        setPageIndex(0);
    };
    return (<Layout_1.default isLoading={isLoadingDeployments || isLoadingProviders} isUsingSettings isUsingWallet>
      <next_seo_1.NextSeo title="Deployments"/>
      {deployments && deployments.length > 0 && isWalletConnected && (<div className="flex flex-wrap items-center pb-2">
          <>
            <Title_1.Title className="font-bold" subTitle>
              Deployments
            </Title_1.Title>

            <div className="ml-4">
              <components_1.Button aria-label="back" onClick={function () { return getDeployments(); }} size="icon" variant="ghost">
                <iconoir_react_1.Refresh />
              </components_1.Button>
            </div>

            <div className="ml-8">
              <div className="flex items-center space-x-2">
                <components_1.CheckboxWithLabel label="Active" checked={isFilteringActive} onCheckedChange={onIsFilteringActiveClick}/>
              </div>
            </div>

            {selectedItemIds.length > 0 && (<>
                <div className="md:ml-4">
                  <components_1.Button onClick={onCloseSelectedDeployments} color="secondary">
                    Close selected ({selectedItemIds.length})
                  </components_1.Button>
                </div>

                <div className="ml-4">
                  <LinkTo_1.LinkTo onClick={clearSelection}>Clear</LinkTo_1.LinkTo>
                </div>
              </>)}

            {((filteredDeployments === null || filteredDeployments === void 0 ? void 0 : filteredDeployments.length) || 0) > 0 && (<link_1.default href={urlUtils_1.UrlService.newDeployment()} className={(0, utils_1.cn)("ml-auto", (0, components_1.buttonVariants)({ variant: "default", size: "sm" }))} aria-disabled={settings.isBlockchainDown} onClick={onDeployClick}>
                Deploy
                <iconoir_react_1.Rocket className="ml-4 rotate-45 text-sm"/>
              </link_1.default>)}
          </>
        </div>)}

      {(((filteredDeployments === null || filteredDeployments === void 0 ? void 0 : filteredDeployments.length) || 0) > 0 || !!search) && (<div className="flex items-center pb-4 pt-2">
          <div className="flex-grow">
            <components_1.Input value={search} onChange={onSearchChange} label="Search Deployments by name" className="w-full" type="text" endIcon={!!search && (<components_1.Button size="icon" variant="text" onClick={function () { return setSearch(""); }}>
                    <iconoir_react_1.Xmark className="text-xs"/>
                  </components_1.Button>)}/>
          </div>
        </div>)}

      {(filteredDeployments === null || filteredDeployments === void 0 ? void 0 : filteredDeployments.length) === 0 && !isLoadingDeployments && !search && (<components_1.Card>
          <components_1.CardContent>
            <div className="p-16 text-center">
              <h3 className="mb-2 text-xl font-bold">{deployments && (deployments === null || deployments === void 0 ? void 0 : deployments.length) > 0 ? "No active deployments." : "No deployments yet."}</h3>

              {isSignedInWithTrial && !user && <p className="text-sm">If you are expecting to see some, you may need to sign-in or connect a wallet</p>}

              {isWalletConnected ? (<link_1.default href={urlUtils_1.UrlService.newDeployment()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default", size: "lg" }), "mt-4")} onClick={onDeployClick} aria-disabled={settings.isBlockchainDown}>
                  Deploy
                  <iconoir_react_1.Rocket className="ml-4 rotate-45 text-sm"/>
                </link_1.default>) : (<div className="mt-8 flex items-center justify-center space-x-2">
                  <ConnectWalletButton_1.ConnectWalletButton />
                  <link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "outline" }))} href={urlUtils_1.UrlService.login()}>
                    Sign in
                  </link_1.default>
                </div>)}
            </div>
          </components_1.CardContent>
        </components_1.Card>)}

      {(!filteredDeployments || (filteredDeployments === null || filteredDeployments === void 0 ? void 0 : filteredDeployments.length) === 0) && isLoadingDeployments && !search && (<div className="flex items-center justify-center p-8">
          <components_1.Spinner size="large"/>
        </div>)}

      <div>
        {orderedDeployments.length > 0 && (<div className="flex flex-wrap items-center justify-between pb-4">
            <span className="text-xs">
              You have <strong>{orderedDeployments.length}</strong>
              {isFilteringActive ? " active" : ""} deployments
            </span>
          </div>)}

        {(currentPageDeployments === null || currentPageDeployments === void 0 ? void 0 : currentPageDeployments.length) > 0 && (<components_1.Table className="min-w-[1024px] table-fixed">
            <colgroup>
              <col width="120"/>
              <col />
              <col width="15%"/>
              <col width="20%"/>
              <col width="25%"/>
              <col width="130px"/>
            </colgroup>
            <components_1.TableHeader>
              <components_1.TableRow>
                <components_1.TableHead className="text-center">Specs</components_1.TableHead>
                <components_1.TableHead className="text-center">Name</components_1.TableHead>
                <components_1.TableHead className="text-center">DSEQ</components_1.TableHead>
                <components_1.TableHead className="text-center">Cost and balance</components_1.TableHead>
                <components_1.TableHead className="text-center">Leases</components_1.TableHead>
                <components_1.TableHead></components_1.TableHead>
              </components_1.TableRow>
            </components_1.TableHeader>

            <components_1.TableBody>
              {currentPageDeployments.map(function (deployment) { return (<DeploymentListRow_1.DeploymentListRow key={deployment.dseq} deployment={deployment} refreshDeployments={getDeployments} providers={providers} isSelectable onSelectDeployment={selectItem} checked={selectedItemIds.includes(deployment.dseq)}/>); })}
            </components_1.TableBody>
          </components_1.Table>)}
      </div>

      {search && currentPageDeployments.length === 0 && (<div className="py-4">
          <p>No deployment found.</p>
        </div>)}

      {((filteredDeployments === null || filteredDeployments === void 0 ? void 0 : filteredDeployments.length) || 0) > 0 && (<div className="flex items-center justify-center py-8">
          <components_1.CustomPagination totalPageCount={pageCount} setPageIndex={handleChangePage} pageIndex={pageIndex} pageSize={pageSize} setPageSize={onPageSizeChange}/>
        </div>)}
    </Layout_1.default>);
};
exports.DeploymentList = DeploymentList;
