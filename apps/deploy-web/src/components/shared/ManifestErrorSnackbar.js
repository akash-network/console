"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManifestErrorSnackbar = void 0;
var components_1 = require("@akashnetwork/ui/components");
var axios_1 = require("axios");
var ManifestErrorSnackbar = function (_a) {
    var err = _a.err, messages = _a.messages;
    return <components_1.Snackbar title="Error" subTitle={"Error while sending manifest to provider. ".concat(generateErrorText(err, messages))} iconVariant="error"/>;
};
exports.ManifestErrorSnackbar = ManifestErrorSnackbar;
function generateErrorText(err, customMessages) {
    var _a, _b, _c, _d;
    if ((0, axios_1.isAxiosError)(err) && ((_a = err.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
        return "You don't have local certificate. Please create a new one.";
    }
    if ((0, axios_1.isAxiosError)(err) && ((_b = err.response) === null || _b === void 0 ? void 0 : _b.status) === 400) {
        if (!((_d = (_c = err.response.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.issues))
            return DEFAULT_ERROR_MESSAGE;
        var errors_1 = new Set();
        err.response.data.error.issues.forEach(function (issue) {
            var _a, _b;
            var key = "".concat(issue.path.join("."), ".").concat((_a = issue.params) === null || _a === void 0 ? void 0 : _a.reason);
            var error = (_b = customMessages === null || customMessages === void 0 ? void 0 : customMessages[key]) !== null && _b !== void 0 ? _b : ERRORS_MAPPING[key];
            if (error) {
                errors_1.add(error);
            }
            else {
                errors_1.add(DEFAULT_ERROR_MESSAGE);
            }
        });
        return Array.from(errors_1).join("\n ");
    }
    return err;
}
var DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try refreshing the page and try again.";
var ERRORS_MAPPING = {
    "certPem.expired": "Your certificate has expired. Please create a new one.",
    "certPem.missingCertPair": "Please provide both public and private key of your certificate.",
    "certPem.invalid": "Provider rejected your certificate. Please try to create a new one. If the problem persists, please contact support."
};
