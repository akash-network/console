"use strict";
"use client";
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
exports.CertificateList = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var ConnectWallet_1 = require("@src/components/shared/ConnectWallet");
var CertificateProvider_1 = require("@src/context/CertificateProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var CertificateDisplay_1 = require("./CertificateDisplay");
var CertificateList = function () {
    var _a = (0, CertificateProvider_1.useCertificate)(), validCertificates = _a.validCertificates, localCert = _a.localCert, selectedCertificate = _a.selectedCertificate, revokeCertificate = _a.revokeCertificate, revokeAllCertificates = _a.revokeAllCertificates, isLoadingCertificates = _a.isLoadingCertificates;
    var address = (0, WalletProvider_1.useWallet)().address;
    var _b = (0, react_1.useState)(0), pageIndex = _b[0], setPageIndex = _b[1];
    var _c = (0, react_1.useState)(10), pageSize = _c[0], setPageSize = _c[1];
    var sortedValidCertificates = __spreadArray([], validCertificates, true).sort(function (a, b) {
        return new Date(b.pem.issuedOn).getTime() - new Date(a.pem.issuedOn).getTime();
    });
    var start = pageIndex * pageSize;
    var end = start + pageSize;
    var currentPageCertificates = sortedValidCertificates.slice(start, end);
    var pageCount = Math.ceil(sortedValidCertificates.length / pageSize);
    var handleChangePage = function (newPage) {
        setPageIndex(newPage);
    };
    var onPageSizeChange = function (value) {
        setPageSize(value);
        setPageIndex(0);
    };
    return (<div>
      <CertificateDisplay_1.CertificateDisplay />

      {address ? (<div>
          <components_1.Table>
            <components_1.TableHeader>
              <components_1.TableRow>
                <components_1.TableHead className="text-center">Selected</components_1.TableHead>
                <components_1.TableHead className="text-center">Local cert</components_1.TableHead>
                <components_1.TableHead className="text-center">Issued on</components_1.TableHead>
                <components_1.TableHead className="text-center">Expires</components_1.TableHead>
                <components_1.TableHead className="text-center">Serial</components_1.TableHead>
                <components_1.TableHead className="text-center">
                  {(validCertificates === null || validCertificates === void 0 ? void 0 : validCertificates.length) > 0 && (<components_1.Button onClick={function () { return revokeAllCertificates(); }} color="secondary" size="sm" variant="outline">
                      Revoke All
                    </components_1.Button>)}
                </components_1.TableHead>
              </components_1.TableRow>
            </components_1.TableHeader>

            <components_1.TableBody>
              {currentPageCertificates.map(function (cert) {
                var isCurrentCert = cert.serial === (selectedCertificate === null || selectedCertificate === void 0 ? void 0 : selectedCertificate.serial);
                return (<components_1.TableRow key={cert.serial}>
                    <components_1.TableCell align="center">{isCurrentCert && <iconoir_react_1.Check className="text-primary"/>}</components_1.TableCell>
                    <components_1.TableCell align="center">{cert.parsed === (localCert === null || localCert === void 0 ? void 0 : localCert.certPem) && <iconoir_react_1.Check className="text-primary"/>}</components_1.TableCell>

                    <components_1.TableCell align="center">
                      <react_intl_1.FormattedDate value={cert.pem.issuedOn} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit"/>
                    </components_1.TableCell>
                    <components_1.TableCell align="center">
                      <react_intl_1.FormattedDate value={cert.pem.expiresOn} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit"/>
                    </components_1.TableCell>
                    <components_1.TableCell align="center">
                      <p className="text-sm text-muted-foreground">{cert.serial}</p>
                    </components_1.TableCell>
                    <components_1.TableCell align="center">
                      <components_1.Button onClick={function () { return revokeCertificate(cert); }} color={isCurrentCert ? "secondary" : "inherit"} size="sm" variant={isCurrentCert ? "default" : "text"}>
                        Revoke
                      </components_1.Button>
                    </components_1.TableCell>
                  </components_1.TableRow>);
            })}
            </components_1.TableBody>
          </components_1.Table>

          {!isLoadingCertificates && validCertificates.length === 0 && (<div className="mt-4 w-full text-center">
              <p>No certificates.</p>
            </div>)}

          {validCertificates.length > 0 && (<div className="flex items-center justify-center py-8">
              <components_1.CustomPagination totalPageCount={pageCount} setPageIndex={handleChangePage} pageIndex={pageIndex} pageSize={pageSize} setPageSize={onPageSizeChange}/>
            </div>)}
        </div>) : (<ConnectWallet_1.ConnectWallet text="Connect your wallet to create a certficate."/>)}
    </div>);
};
exports.CertificateList = CertificateList;
