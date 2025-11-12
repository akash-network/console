"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPENDENCIES = void 0;
exports.useProviderCredentials = useProviderCredentials;
var react_1 = require("react");
var CertificateProvider_1 = require("@src/context/CertificateProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var useProviderJwt_1 = require("../useProviderJwt/useProviderJwt");
exports.DEPENDENCIES = {
    useSettings: SettingsProvider_1.useSettings,
    useCertificate: CertificateProvider_1.useCertificate,
    useProviderJwt: useProviderJwt_1.useProviderJwt
};
function useProviderCredentials(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.dependencies, d = _c === void 0 ? exports.DEPENDENCIES : _c;
    var settings = d.useSettings().settings;
    var _d = d.useCertificate(), createCertificate = _d.createCertificate, isLocalCertExpired = _d.isLocalCertExpired, isLocalCertMatching = _d.isLocalCertMatching, localCert = _d.localCert;
    var _e = d.useProviderJwt(), accessToken = _e.accessToken, generateToken = _e.generateToken, isTokenExpired = _e.isTokenExpired;
    var generate = (0, react_1.useCallback)(function () {
        return settings.isBlockchainDown ? generateToken() : createCertificate();
    }, [settings.isBlockchainDown, createCertificate, generateToken]);
    var credentials = (0, react_1.useMemo)(function () {
        return settings.isBlockchainDown
            ? {
                type: "jwt",
                value: accessToken,
                isExpired: isTokenExpired,
                usable: !!accessToken && !isTokenExpired
            }
            : {
                type: "mtls",
                value: (localCert === null || localCert === void 0 ? void 0 : localCert.certPem) && (localCert === null || localCert === void 0 ? void 0 : localCert.keyPem)
                    ? {
                        cert: localCert.certPem,
                        key: localCert.keyPem
                    }
                    : null,
                isExpired: isLocalCertExpired,
                usable: !!(localCert === null || localCert === void 0 ? void 0 : localCert.certPem) && !!(localCert === null || localCert === void 0 ? void 0 : localCert.keyPem) && !isLocalCertExpired && isLocalCertMatching
            };
    }, [settings.isBlockchainDown, localCert, accessToken, isLocalCertExpired, isLocalCertMatching, isTokenExpired]);
    return (0, react_1.useMemo)(function () { return ({
        details: credentials,
        generate: generate
    }); }, [credentials, generate]);
}
