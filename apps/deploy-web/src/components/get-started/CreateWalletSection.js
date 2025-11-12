"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateWalletSection = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var ExternalLink_1 = require("../shared/ExternalLink");
var CreateWalletSection = function () {
    return (<ul className="list-[lower-alpha] space-y-2 py-4 pl-8">
      <li>
        Navigate to the <ExternalLink_1.ExternalLink href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap" text="Keplr Wallet extension"/>{" "}
        in the Google Chrome store and follow the on-screen prompts to add the extension to your web browser
      </li>
      <li>Open the browser extension and select Create new account.</li>
      <li>Copy your mnemonic seed phrase and store it somewhere safe</li>
      <components_1.Alert variant="warning" className="my-4">
        Ensure that you store your mnemonic seed phrase somewhere safe where it cannot be lost or compromised. Your mnemonic seed phrase is the master key to
        your wallet; loss or compromise of your mnemonic seed phrase may result in permanent loss of your ATOM.
      </components_1.Alert>
      <li>Establish an account name and password, then select Next.</li>
      <li>Confirm your mnemonic seed phrase and select Register.</li>
      <li>Done!</li>
    </ul>);
};
exports.CreateWalletSection = CreateWalletSection;
