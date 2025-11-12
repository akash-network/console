"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateDisplay = CertificateDisplay;
var react_1 = require("react");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var FormPaper_1 = require("@src/components/sdl/FormPaper");
var CustomDropdownLinkItem_1 = require("@src/components/shared/CustomDropdownLinkItem");
var WalletProvider_1 = require("@src/context/WalletProvider");
var CertificateProvider_1 = require("../../context/CertificateProvider");
var ExportCertificate_1 = require("./ExportCertificate");
function CertificateDisplay() {
    var _a = (0, react_1.useState)(false), isExportingCert = _a[0], setIsExportingCert = _a[1];
    var _b = (0, CertificateProvider_1.useCertificate)(), selectedCertificate = _b.selectedCertificate, isLocalCertMatching = _b.isLocalCertMatching, isLoadingCertificates = _b.isLoadingCertificates, loadValidCertificates = _b.loadValidCertificates, localCert = _b.localCert, createCertificate = _b.createCertificate, isCreatingCert = _b.isCreatingCert, regenerateCertificate = _b.regenerateCertificate, revokeCertificate = _b.revokeCertificate;
    var address = (0, WalletProvider_1.useWallet)().address;
    var onRegenerateCert = function () {
        regenerateCertificate();
    };
    var onRevokeCert = function () {
        if (selectedCertificate)
            revokeCertificate(selectedCertificate);
    };
    return (<>
      {address && (<FormPaper_1.FormPaper className="mb-4" contentClassName="flex items-center">
          <div className="flex items-center">
            <p className="text-muted-foreground">
              {selectedCertificate ? (<span>
                  Current certificate:{" "}
                  <span className="inline-flex items-center text-xs font-bold text-primary">
                    {selectedCertificate.serial} <iconoir_react_1.Check color="secondary" className="ml-2"/>
                  </span>
                </span>) : ("No local certificate.")}
            </p>

            {selectedCertificate && !isLocalCertMatching && (<components_1.CustomTooltip title="The local certificate doesn't match the one on the blockchain. You can revoke it and create a new one.">
                <iconoir_react_1.WarningTriangle className="ml-2 text-sm text-destructive"/>
              </components_1.CustomTooltip>)}
          </div>

          {!selectedCertificate && (<div className="ml-4">
              <components_1.Button variant="default" color="secondary" size="sm" disabled={isCreatingCert || isLoadingCertificates} onClick={function () { return createCertificate(); }}>
                {isCreatingCert ? <components_1.Spinner size="small"/> : "Create Certificate"}
              </components_1.Button>
            </div>)}

          <components_1.Button onClick={function () { return loadValidCertificates(true); }} aria-label="refresh" disabled={isLoadingCertificates} size="icon" variant="outline" className="ml-4">
            {isLoadingCertificates ? <components_1.Spinner size="small"/> : <iconoir_react_1.Refresh />}
          </components_1.Button>

          {selectedCertificate && (<div className="ml-2">
              <components_1.DropdownMenu modal={false}>
                <components_1.DropdownMenuTrigger asChild>
                  <components_1.Button size="icon" variant="ghost">
                    <iconoir_react_1.MoreHoriz />
                  </components_1.Button>
                </components_1.DropdownMenuTrigger>
                <components_1.DropdownMenuContent align="end">
                  {/** If local, regenerate else create */}
                  {selectedCertificate.parsed === (localCert === null || localCert === void 0 ? void 0 : localCert.certPem) ? (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return onRegenerateCert(); }} icon={<md_1.MdAutorenew />}>
                      Regenerate
                    </CustomDropdownLinkItem_1.CustomDropdownLinkItem>) : (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return createCertificate(); }} icon={<iconoir_react_1.PlusCircle />}>
                      Create
                    </CustomDropdownLinkItem_1.CustomDropdownLinkItem>)}

                  <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return onRevokeCert(); }} icon={<iconoir_react_1.BinMinusIn />}>
                    Revoke
                  </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                  <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return setIsExportingCert(true); }} icon={<md_1.MdGetApp />}>
                    Export
                  </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                </components_1.DropdownMenuContent>
              </components_1.DropdownMenu>
            </div>)}
        </FormPaper_1.FormPaper>)}

      {isExportingCert && <ExportCertificate_1.ExportCertificate isOpen={isExportingCert} onClose={function () { return setIsExportingCert(false); }}/>}
    </>);
}
