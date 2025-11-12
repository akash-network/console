"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDeploymentSettingQuery = useDeploymentSettingQuery;
var react_1 = require("react");
var http_sdk_1 = require("@akashnetwork/http-sdk");
var react_query_1 = require("@tanstack/react-query");
var constants_1 = require("date-fns/constants");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var queryKeys_1 = require("./queryKeys");
function useDeploymentSettingQuery(params) {
    var wallet = (0, WalletProvider_1.useWallet)();
    var queryKey = (0, react_1.useMemo)(function () { return (params.userId ? queryKeys_1.QueryKeys.getDeploymentSettingKey(params.userId, params.dseq) : []); }, [params.userId, params.dseq]);
    var deploymentSetting = (0, ServicesProvider_1.useServices)().deploymentSetting;
    var queryClient = (0, react_query_1.useQueryClient)();
    var query = (0, react_query_1.useQuery)({
        queryKey: queryKey,
        queryFn: function () {
            if (!params.userId) {
                throw new Error("userId is required");
            }
            return deploymentSetting.findByUserIdAndDseq({ userId: params.userId, dseq: params.dseq });
        },
        enabled: !!params.userId && !!params.dseq && !!wallet.isManaged,
        staleTime: 5 * constants_1.millisecondsInMinute,
        retry: function (failureCount, error) {
            var _a;
            if ((0, http_sdk_1.isHttpError)(error) && ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                return false;
            }
            return failureCount < 3;
        }
    });
    var update = (0, react_query_1.useMutation)({
        mutationFn: function (autoTopUpEnabled) {
            if (!wallet.isManaged) {
                throw new Error("Cannot update deployment setting for a custodial wallet");
            }
            if (!params.userId) {
                throw new Error("userId is required");
            }
            return deploymentSetting.update({ userId: params.userId, dseq: params.dseq }, { autoTopUpEnabled: autoTopUpEnabled });
        },
        onSuccess: function (data) {
            queryClient.setQueryData(queryKey, data);
        }
    });
    var setAutoTopUpEnabled = function (autoTopUpEnabled) {
        update.mutate(autoTopUpEnabled);
    };
    return {
        data: query.data,
        update: update.mutate,
        setAutoTopUpEnabled: setAutoTopUpEnabled,
        isLoading: query.isLoading || update.isPending,
        isFetching: query.isLoading,
        isUpdating: update.isPending,
        error: query.error
    };
}
