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
exports.Authorizations = void 0;
var react_1 = require("react");
var react_2 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var next_seo_1 = require("next-seo");
var Fieldset_1 = require("@src/components/shared/Fieldset");
var browser_env_config_1 = require("@src/config/browser-env.config");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useAllowance_1 = require("@src/hooks/useAllowance");
var useExactDeploymentGrantsQuery_1 = require("@src/queries/useExactDeploymentGrantsQuery");
var useGrantsQuery_1 = require("@src/queries/useGrantsQuery");
var address_1 = require("@src/utils/address");
var priceUtils_1 = require("@src/utils/priceUtils");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var Layout_1 = require("../layout/Layout");
var SettingsLayout_1 = require("../settings/SettingsLayout");
var ConnectWallet_1 = require("../shared/ConnectWallet");
var Title_1 = require("../shared/Title");
var AllowanceGrantedRow_1 = require("./AllowanceGrantedRow");
var AllowanceModal_1 = require("./AllowanceModal");
var DeploymentGrantTable_1 = require("./DeploymentGrantTable");
var FeeGrantTable_1 = require("./FeeGrantTable");
var GranteeRow_1 = require("./GranteeRow");
var GrantModal_1 = require("./GrantModal");
var defaultRefetchInterval = 30 * 1000;
var refreshingInterval = 1000;
var MASTER_WALLETS = new Set([
    browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS,
    browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS
]);
var selectNonMasterGrants = function (data) { return (__assign(__assign({}, data), { grants: data.grants.filter(function (_a) {
        var grantee = _a.grantee;
        return !MASTER_WALLETS.has(grantee);
    }) })); };
var selectNonMasterAllowances = function (data) { return (__assign(__assign({}, data), { allowances: data.allowances.filter(function (_a) {
        var grantee = _a.grantee;
        return !MASTER_WALLETS.has(grantee);
    }) })); };
var Authorizations = function () {
    var _a, _b, _c;
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var _d = (0, WalletProvider_1.useWallet)(), address = _d.address, signAndBroadcastTx = _d.signAndBroadcastTx, isManaged = _d.isManaged;
    var _e = (0, useAllowance_1.useAllowance)(address, isManaged).fee, allowancesGranted = _e.all, isLoadingAllowancesGranted = _e.isLoading, setDefault = _e.setDefault, defaultAllowance = _e.default;
    var _f = (0, react_1.useState)(null), editingGrant = _f[0], setEditingGrant = _f[1];
    var _g = (0, react_1.useState)(null), editingAllowance = _g[0], setEditingAllowance = _g[1];
    var _h = (0, react_1.useState)(false), showGrantModal = _h[0], setShowGrantModal = _h[1];
    var _j = (0, react_1.useState)(false), showAllowanceModal = _j[0], setShowAllowanceModal = _j[1];
    var _k = (0, react_1.useState)(null), deletingGrants = _k[0], setDeletingGrants = _k[1];
    var _l = (0, react_1.useState)(null), deletingAllowances = _l[0], setDeletingAllowances = _l[1];
    var _m = (0, react_1.useState)(null), isRefreshing = _m[0], setIsRefreshing = _m[1];
    var _o = (0, react_1.useState)([]), selectedGrants = _o[0], setSelectedGrants = _o[1];
    var _p = (0, react_1.useState)([]), selectedAllowances = _p[0], setSelectedAllowances = _p[1];
    var _q = (0, react_1.useState)(""), searchGrantee = _q[0], setSearchGrantee = _q[1];
    var _r = (0, react_1.useState)(null), searchError = _r[0], setSearchError = _r[1];
    var _s = (0, react_1.useState)({ deployment: 0, fee: 0 }), pageIndex = _s[0], setPageIndex = _s[1];
    var _t = (0, react_1.useState)({ deployment: 10, fee: 10 }), pageSize = _t[0], setPageSize = _t[1];
    var debouncedSearchGrantee = (0, components_1.useDebounce)(searchGrantee, 500);
    var _u = (0, useGrantsQuery_1.useGranterGrants)(address, pageIndex.deployment, pageSize.deployment, {
        refetchInterval: isRefreshing === "granterGrants" ? refreshingInterval : defaultRefetchInterval,
        select: selectNonMasterGrants,
        enabled: !debouncedSearchGrantee
    }), granterGrants = _u.data, isLoadingGranterGrants = _u.isLoading;
    var _v = (0, useGrantsQuery_1.useGranteeGrants)(address, {
        refetchInterval: isRefreshing === "granteeGrants" ? refreshingInterval : defaultRefetchInterval
    }), granteeGrants = _v.data, isLoadingGranteeGrants = _v.isLoading;
    var _w = (0, useGrantsQuery_1.useAllowancesIssued)(address, pageIndex.fee, pageSize.fee, {
        refetchInterval: isRefreshing === "allowancesIssued" ? refreshingInterval : defaultRefetchInterval,
        select: selectNonMasterAllowances
    }), allowancesIssued = _w.data, isLoadingAllowancesIssued = _w.isLoading;
    var _x = (0, useExactDeploymentGrantsQuery_1.useExactDeploymentGrantsQuery)(address, searchGrantee, {
        enabled: false
    }), specificGranteeGrants = _x.data, isLoadingGranterGranteeGrants = _x.isLoading, refetchGranterGranteeGrants = _x.refetch;
    var filteredGranterGrants = !!debouncedSearchGrantee && !!specificGranteeGrants ? { grants: [specificGranteeGrants], pagination: { total: 1 } } : granterGrants;
    var isLoading = !!isRefreshing ||
        isLoadingAllowancesIssued ||
        isLoadingAllowancesGranted ||
        isLoadingGranteeGrants ||
        isLoadingGranterGrants ||
        isLoadingGranterGranteeGrants;
    (0, react_1.useEffect)(function () {
        var timeout;
        if (isRefreshing) {
            timeout = setTimeout(function () {
                setIsRefreshing(null);
            }, priceUtils_1.averageBlockTime * 1000);
        }
        return function () {
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, [isRefreshing]);
    (0, react_1.useEffect)(function () {
        if (debouncedSearchGrantee && !searchError) {
            refetchGranterGranteeGrants();
        }
    }, [debouncedSearchGrantee, searchError, refetchGranterGranteeGrants]);
    function onDeleteGrantsConfirmed() {
        return __awaiter(this, void 0, void 0, function () {
            var messages, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!deletingGrants)
                            return [2 /*return*/];
                        messages = deletingGrants.map(function (grant) { return TransactionMessageData_1.TransactionMessageData.getRevokeDepositMsg(address, grant.grantee); });
                        return [4 /*yield*/, signAndBroadcastTx(messages)];
                    case 1:
                        response = _a.sent();
                        if (response) {
                            setIsRefreshing("granterGrants");
                            setDeletingGrants(null);
                            setSelectedGrants([]);
                        }
                        return [2 /*return*/];
                }
            });
        });
    }
    function onDeleteAllowanceConfirmed() {
        return __awaiter(this, void 0, void 0, function () {
            var messages, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!deletingAllowances)
                            return [2 /*return*/];
                        messages = deletingAllowances.map(function (allowance) { return TransactionMessageData_1.TransactionMessageData.getRevokeAllowanceMsg(address, allowance.grantee); });
                        return [4 /*yield*/, signAndBroadcastTx(messages)];
                    case 1:
                        response = _a.sent();
                        if (response) {
                            setIsRefreshing("allowancesIssued");
                            setDeletingAllowances(null);
                            setSelectedAllowances([]);
                        }
                        return [2 /*return*/];
                }
            });
        });
    }
    function onCreateNewGrant() {
        setEditingGrant(null);
        setShowGrantModal(true);
    }
    function onEditGrant(grant) {
        setEditingGrant(grant);
        setShowGrantModal(true);
    }
    function onGrantClose() {
        setIsRefreshing("granterGrants");
        setShowGrantModal(false);
    }
    function onCreateNewAllowance() {
        setEditingAllowance(null);
        setShowAllowanceModal(true);
    }
    function onAllowanceClose() {
        setIsRefreshing("allowancesIssued");
        setShowAllowanceModal(false);
    }
    function onEditAllowance(allowance) {
        setEditingAllowance(allowance);
        setShowAllowanceModal(true);
    }
    function onSearchGranteeChange(e) {
        var _a;
        var value = (_a = e.target.value) === null || _a === void 0 ? void 0 : _a.trim();
        setSearchGrantee(value);
        if (!value) {
            setSearchError(null);
            return;
        }
        if (!(0, address_1.isValidBech32Address)(value, "akash")) {
            setSearchError("Invalid Akash address");
            return;
        }
        setSearchError(null);
    }
    function onAllowancePageChange(newPageIndex, newPageSize) {
        setPageIndex(function (prev) { return (__assign(__assign({}, prev), { fee: newPageIndex })); });
        setPageSize(function (prev) { return (__assign(__assign({}, prev), { fee: newPageSize })); });
    }
    function onDeploymentPageChange(newPageIndex, newPageSize) {
        setPageIndex(function (prev) { return (__assign(__assign({}, prev), { deployment: newPageIndex })); });
        setPageSize(function (prev) { return (__assign(__assign({}, prev), { deployment: newPageSize })); });
    }
    function onRefreshSearchClick() {
        if (!searchError && debouncedSearchGrantee) {
            refetchGranterGranteeGrants();
        }
    }
    return (<Layout_1.default isLoading={isLoading}>
      <next_seo_1.NextSeo title="Settings Authorizations"/>

      {settings.isBlockchainDown ? (<SettingsLayout_1.SettingsLayout title="" page={SettingsLayout_1.SettingsTabs.AUTHORIZATIONS}>
          <>
            <h3 className="mb-4 text-muted-foreground">The blockchain is unavailable. Unable to create, list, or update authorizations.</h3>
          </>
        </SettingsLayout_1.SettingsLayout>) : (<>
          <SettingsLayout_1.SettingsLayout title="Deployment Authorizations" page={SettingsLayout_1.SettingsTabs.AUTHORIZATIONS} headerActions={address && (<div className="md:ml-4">
                  <components_1.Button onClick={onCreateNewGrant} color="secondary" variant="default" type="button" size="sm">
                    <iconoir_react_1.Bank />
                    &nbsp;Authorize Spend
                  </components_1.Button>
                </div>)}>
            {!address ? (<>
                <Fieldset_1.Fieldset label="" className="mb-4">
                  <ConnectWallet_1.ConnectWallet text="Connect your wallet to create a deployment authorization."/>
                </Fieldset_1.Fieldset>
              </>) : (<>
                <h3 className="mb-4 text-muted-foreground">
                  These authorizations allow you authorize other addresses to spend on deployments or deployment deposits using your funds. You can revoke these
                  authorizations at any time.
                </h3>
                <Fieldset_1.Fieldset label="Authorizations Given" className="mb-4">
                  <div className="mb-4 flex items-center gap-2">
                    <components_1.Input type="text" placeholder="Search by grantee address..." value={searchGrantee} onChange={onSearchGranteeChange} className="max-w-md flex-grow" error={!!searchError} endIcon={<components_1.Button variant="text" size="icon" onClick={function () {
                        setSearchGrantee("");
                        setSearchError(null);
                    }}>
                          <iconoir_react_1.Xmark />
                        </components_1.Button>}/>
                    <components_1.Button variant="ghost" size="icon" className="rounded-full" onClick={onRefreshSearchClick}>
                      <iconoir_react_1.Refresh className="text-xs"/>
                    </components_1.Button>
                  </div>
                  {isLoadingGranterGrants || !filteredGranterGrants ? (<div className="flex items-center justify-center">
                      <components_1.Spinner size="large"/>
                    </div>) : (<>
                      {((_a = filteredGranterGrants === null || filteredGranterGrants === void 0 ? void 0 : filteredGranterGrants.grants) === null || _a === void 0 ? void 0 : _a.length) > 0 ? (<DeploymentGrantTable_1.DeploymentGrantTable grants={filteredGranterGrants.grants} totalCount={((_b = filteredGranterGrants === null || filteredGranterGrants === void 0 ? void 0 : filteredGranterGrants.pagination) === null || _b === void 0 ? void 0 : _b.total) || 0} selectedGrants={selectedGrants} onEditGrant={onEditGrant} onPageChange={onDeploymentPageChange} setDeletingGrants={setDeletingGrants} setSelectedGrants={setSelectedGrants} pageIndex={pageIndex.deployment} pageSize={pageSize.deployment}/>) : (<p className="text-sm text-muted-foreground">
                          {searchGrantee
                            ? searchError
                                ? "Please enter a valid Akash address"
                                : "No matching authorizations found."
                            : "No authorizations given."}
                        </p>)}
                    </>)}
                </Fieldset_1.Fieldset>

                <Fieldset_1.Fieldset label="Authorizations Received" className="mb-4">
                  {isLoadingGranteeGrants || !granteeGrants ? (<div className="flex items-center justify-center">
                      <components_1.Spinner size="large"/>
                    </div>) : (<>
                      {granteeGrants.length > 0 ? (<components_1.Table>
                          <components_1.TableHeader>
                            <components_1.TableRow>
                              <components_1.TableHead>Granter</components_1.TableHead>
                              <components_1.TableHead className="text-right">Spending Limit</components_1.TableHead>
                              <components_1.TableHead className="text-right">Expiration</components_1.TableHead>
                            </components_1.TableRow>
                          </components_1.TableHeader>

                          <components_1.TableBody>
                            {granteeGrants.map(function (grant) { return (<GranteeRow_1.GranteeRow key={grant.granter} grant={grant}/>); })}
                          </components_1.TableBody>
                        </components_1.Table>) : (<p className="text-sm text-muted-foreground">No authorizations received.</p>)}
                    </>)}
                </Fieldset_1.Fieldset>
              </>)}

            <div className="flex flex-wrap items-center py-4">
              <Title_1.Title>Tx Fee Authorizations</Title_1.Title>
              {address && (<components_1.Button onClick={onCreateNewAllowance} color="secondary" variant="default" className="md:ml-4" type="button" size="sm">
                  <iconoir_react_1.Bank />
                  &nbsp;Authorize Fee Spend
                </components_1.Button>)}
            </div>

            {!address ? (<>
                <Fieldset_1.Fieldset label="" className="mb-4">
                  <ConnectWallet_1.ConnectWallet text="Connect your wallet to create a tx fee authorization."/>
                </Fieldset_1.Fieldset>
              </>) : (<>
                <h3 className="mb-4 text-muted-foreground">
                  These authorizations allow you authorize other addresses to spend on transaction fees using your funds. You can revoke these authorizations at
                  any time.
                </h3>

                <Fieldset_1.Fieldset label="Authorizations Given" className="mb-4">
                  {isLoadingAllowancesIssued || !allowancesIssued ? (<div className="flex items-center justify-center">
                      <components_1.Spinner size="large"/>
                    </div>) : (<>
                      {allowancesIssued.allowances.length > 0 ? (<FeeGrantTable_1.FeeGrantTable allowances={allowancesIssued.allowances} selectedAllowances={selectedAllowances} onEditAllowance={onEditAllowance} setDeletingAllowances={setDeletingAllowances} setSelectedAllowances={setSelectedAllowances} pageIndex={pageIndex.fee} pageSize={pageSize.fee} onPageChange={onAllowancePageChange} totalCount={((_c = allowancesIssued.pagination) === null || _c === void 0 ? void 0 : _c.total) || 0}/>) : (<p className="text-sm text-muted-foreground">No allowances issued.</p>)}
                    </>)}
                </Fieldset_1.Fieldset>

                <Fieldset_1.Fieldset label="Authorizations Received" className="mb-4">
                  {isLoadingAllowancesGranted || !allowancesGranted ? (<div className="flex items-center justify-center">
                      <components_1.Spinner size="large"/>
                    </div>) : (<>
                      {allowancesGranted.length > 0 ? (<components_1.Table>
                          <components_1.TableHeader>
                            <components_1.TableRow>
                              <components_1.TableHead>Default</components_1.TableHead>
                              <components_1.TableHead>Type</components_1.TableHead>
                              <components_1.TableHead>Grantee</components_1.TableHead>
                              <components_1.TableHead>Spending Limit</components_1.TableHead>
                              <components_1.TableHead className="text-right">Expiration</components_1.TableHead>
                            </components_1.TableRow>
                          </components_1.TableHeader>

                          <components_1.TableBody>
                            {!!allowancesGranted && (<AllowanceGrantedRow_1.AllowanceGrantedRow key={address} allowance={{
                                granter: "",
                                grantee: "",
                                allowance: { "@type": "$CONNECTED_WALLET", expiration: "", spend_limit: [] }
                            }} onSelect={function () { return setDefault(undefined); }} selected={!defaultAllowance}/>)}
                            {allowancesGranted.map(function (allowance) { return (<AllowanceGrantedRow_1.AllowanceGrantedRow key={allowance.granter} allowance={allowance} onSelect={function () { return setDefault(allowance.granter); }} selected={defaultAllowance === allowance.granter}/>); })}
                          </components_1.TableBody>
                        </components_1.Table>) : (<p className="text-sm text-muted-foreground">No allowances received.</p>)}
                    </>)}
                </Fieldset_1.Fieldset>
              </>)}

            {!!deletingGrants && (<components_1.Popup open={true} title="Confirm Delete?" variant="confirm" onClose={function () { return setDeletingGrants(null); }} onCancel={function () { return setDeletingGrants(null); }} onValidate={onDeleteGrantsConfirmed} enableCloseOnBackdropClick>
                Deleting grants will revoke their ability to spend your funds on deployments.
              </components_1.Popup>)}
            {!!deletingAllowances && (<components_1.Popup open={true} title="Confirm Delete?" variant="confirm" onClose={function () { return setDeletingAllowances(null); }} onCancel={function () { return setDeletingAllowances(null); }} onValidate={onDeleteAllowanceConfirmed} enableCloseOnBackdropClick>
                Deleting allowance to will revoke their ability to fees on your behalf.
              </components_1.Popup>)}
            {showGrantModal && <GrantModal_1.GrantModal editingGrant={editingGrant} address={address} onClose={onGrantClose}/>}
            {showAllowanceModal && <AllowanceModal_1.AllowanceModal editingAllowance={editingAllowance} address={address} onClose={onAllowanceClose}/>}
          </SettingsLayout_1.SettingsLayout>
        </>)}
    </Layout_1.default>);
};
exports.Authorizations = Authorizations;
