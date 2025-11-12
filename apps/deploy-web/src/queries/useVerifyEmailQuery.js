"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useVerifyEmail = useVerifyEmail;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
function useVerifyEmail(options) {
    if (options === void 0) { options = {}; }
    var auth = (0, ServicesProvider_1.useServices)().auth;
    return (0, react_query_1.useMutation)({
        mutationFn: function (email) { return auth.verifyEmail(email); },
        onSuccess: function (response) {
            var _a;
            (_a = options.onSuccess) === null || _a === void 0 ? void 0 : _a.call(options, response.data.emailVerified);
        },
        onError: function (_error) {
            var _a;
            (_a = options.onError) === null || _a === void 0 ? void 0 : _a.call(options);
        }
    });
}
