"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAllowance = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var isAfter_1 = require("date-fns/isAfter");
var parseISO_1 = require("date-fns/parseISO");
var iconoir_react_1 = require("iconoir-react");
var difference_1 = require("lodash/difference");
var link_1 = require("next/link");
var notistack_1 = require("notistack");
var usehooks_ts_1 = require("usehooks-ts");
var useWhen_1 = require("@src/hooks/useWhen");
var useGrantsQuery_1 = require("@src/queries/useGrantsQuery");
var persisted = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("fee-granters") || "{}") : {};
var AllowanceNotificationMessage = function () { return (<>
    You can update default fee granter in
    <link_1.default href="/settings/authorizations" className="inline-flex items-center space-x-2 !text-white">
      <span>Authorizations Settings</span>
      <iconoir_react_1.OpenNewWindow className="text-xs"/>
    </link_1.default>
  </>); };
var useAllowance = function (address, isManaged) {
    var _a = (0, usehooks_ts_1.useLocalStorage)("default-fee-granters/".concat(address), undefined), defaultFeeGranter = _a[0], setDefaultFeeGranter = _a[1];
    var _b = (0, useGrantsQuery_1.useAllowancesGranted)(address), allFeeGranters = _b.data, isLoading = _b.isLoading, isFetched = _b.isFetched;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var actualAllowanceAddresses = (0, react_1.useMemo)(function () {
        if (!address || !allFeeGranters) {
            return null;
        }
        return allFeeGranters.reduce(function (acc, grant) {
            if ((0, isAfter_1.default)((0, parseISO_1.default)(grant.allowance.expiration), new Date())) {
                acc.push(grant.granter);
            }
            return acc;
        }, []);
    }, [allFeeGranters, address]);
    (0, useWhen_1.useWhen)(isFetched && address && !isManaged && !!actualAllowanceAddresses, function () {
        var _actualAllowanceAddresses = actualAllowanceAddresses;
        var persistedAddresses = persisted[address] || [];
        var added = (0, difference_1.default)(_actualAllowanceAddresses, persistedAddresses);
        var removed = (0, difference_1.default)(persistedAddresses, _actualAllowanceAddresses);
        if (added.length || removed.length) {
            persisted[address] = _actualAllowanceAddresses;
            localStorage.setItem("fee-granters", JSON.stringify(persisted));
        }
        if (added.length) {
            enqueueSnackbar(<components_1.Snackbar iconVariant="info" title="New fee allowance granted" subTitle={<AllowanceNotificationMessage />}/>, {
                variant: "info"
            });
        }
        if (removed.length) {
            enqueueSnackbar(<components_1.Snackbar iconVariant="warning" title="Some fee allowance is revoked or expired" subTitle={<AllowanceNotificationMessage />}/>, {
                variant: "warning"
            });
        }
        if (defaultFeeGranter && removed.includes(defaultFeeGranter)) {
            setDefaultFeeGranter(undefined);
        }
        else if (!defaultFeeGranter && _actualAllowanceAddresses.length) {
            setDefaultFeeGranter(_actualAllowanceAddresses[0]);
        }
    }, [actualAllowanceAddresses, persisted]);
    return (0, react_1.useMemo)(function () { return ({
        fee: {
            all: allFeeGranters,
            default: defaultFeeGranter,
            setDefault: setDefaultFeeGranter,
            isLoading: isLoading
        }
    }); }, [defaultFeeGranter, setDefaultFeeGranter, allFeeGranters, isLoading]);
};
exports.useAllowance = useAllowance;
