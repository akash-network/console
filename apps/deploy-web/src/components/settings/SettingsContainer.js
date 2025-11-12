"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsContainer = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var navigation_1 = require("next/navigation");
var next_seo_1 = require("next-seo");
var AutoTopUpSettingContainer_1 = require("@src/components/settings/AutoTopUpSetting/AutoTopUpSettingContainer");
var LocalDataManager_1 = require("@src/components/settings/LocalDataManager");
var Fieldset_1 = require("@src/components/shared/Fieldset");
var LabelValue_1 = require("@src/components/shared/LabelValue");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var useWhen_1 = require("@src/hooks/useWhen");
var networkStore_1 = require("@src/store/networkStore");
var Layout_1 = require("../layout/Layout");
var CertificateList_1 = require("./CertificateList");
var ColorModeSelect_1 = require("./ColorModeSelect");
var SelectNetworkModal_1 = require("./SelectNetworkModal");
var SettingsForm_1 = require("./SettingsForm");
var SettingsLayout_1 = require("./SettingsLayout");
var SettingsContainer = function () {
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var _a = (0, react_1.useState)(false), isSelectingNetwork = _a[0], setIsSelectingNetwork = _a[1];
    var selectedNetwork = networkStore_1.default.useSelectedNetwork();
    var wallet = (0, WalletProvider_1.useWallet)();
    var router = (0, navigation_1.useRouter)();
    var isCustodialAutoTopupEnabled = (0, useFlag_1.useFlag)("custodial_auto_topup");
    (0, useWhen_1.useWhen)(!wallet.isWalletConnected || wallet.isManaged, function () { return router.push("/"); });
    var onSelectNetworkModalClose = function () {
        setIsSelectingNetwork(false);
    };
    return (<Layout_1.default isUsingSettings>
      <next_seo_1.NextSeo title="Settings"/>

      <SettingsLayout_1.SettingsLayout page={SettingsLayout_1.SettingsTabs.GENERAL} title="Settings">
        {isSelectingNetwork && <SelectNetworkModal_1.SelectNetworkModal onClose={onSelectNetworkModalClose}/>}
        <div className="grid-col-1 mb-4 grid gap-4 md:grid-cols-2">
          <Fieldset_1.Fieldset label="Network">
            <LabelValue_1.LabelValue value={<div className="inline-flex items-center">
                  <strong>{selectedNetwork.title}</strong>

                  <components_1.Button onClick={function () { return setIsSelectingNetwork(true); }} size="icon" className="ml-4" variant="outline" aria-label="Select Network">
                    <iconoir_react_1.Edit className="text-sm"/>
                  </components_1.Button>
                </div>}/>

            <SettingsForm_1.SettingsForm />
          </Fieldset_1.Fieldset>

          <Fieldset_1.Fieldset label="General">
            <ColorModeSelect_1.ColorModeSelect />
            <LocalDataManager_1.LocalDataManager />
          </Fieldset_1.Fieldset>

          {isCustodialAutoTopupEnabled && (<Fieldset_1.Fieldset label="Auto Top Up">
              <AutoTopUpSettingContainer_1.AutoTopUpSettingContainer />
            </Fieldset_1.Fieldset>)}
        </div>

        {!settings.isBlockchainDown && (<Fieldset_1.Fieldset label="Certificates" className="mb-4">
            <CertificateList_1.CertificateList />
          </Fieldset_1.Fieldset>)}
      </SettingsLayout_1.SettingsLayout>
    </Layout_1.default>);
};
exports.SettingsContainer = SettingsContainer;
