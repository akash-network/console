"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectWallet = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var walletStore_1 = require("@src/store/walletStore");
var urlUtils_1 = require("@src/utils/urlUtils");
var WalletStatus_1 = require("../layout/WalletStatus");
var Title_1 = require("./Title");
var ConnectWallet = function (_a) {
    var text = _a.text;
    var isSignedInWithTrial = (0, jotai_1.useAtom)(walletStore_1.default.isSignedInWithTrial)[0];
    return (<div className="mx-auto max-w-[400px] text-center">
      <Title_1.Title className="mb-4 text-center !text-lg" subTitle>
        {text}
      </Title_1.Title>
      <div className="flex items-center justify-center gap-2">
        <WalletStatus_1.WalletStatus />
        {isSignedInWithTrial && (<link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "outline" }))} href={urlUtils_1.UrlService.login()}>
            Sign in
          </link_1.default>)}
      </div>
    </div>);
};
exports.ConnectWallet = ConnectWallet;
