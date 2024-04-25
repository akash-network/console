"use client";
import React from "react";
import { ExternalLink } from "../shared/ExternalLink";
import { Alert } from "../ui/alert";

type Props = {};

export const CreateWalletSection: React.FunctionComponent<Props> = ({}) => {
  return (
    <ul className="list-[lower-alpha] space-y-2 py-4 pl-8">
      <li>
        Navigate to the <ExternalLink href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap" text="Keplr Wallet extension" />{" "}
        in the Google Chrome store and follow the on-screen prompts to add the extension to your web browser
      </li>
      <li>Open the browser extension and select Create new account.</li>
      <li>Copy your mnemonic seed phrase and store it somewhere safe</li>
      <Alert variant="warning" className="my-4">
        Ensure that you store your mnemonic seed phrase somewhere safe where it cannot be lost or compromised. Your mnemonic seed phrase is the master key to
        your wallet; loss or compromise of your mnemonic seed phrase may result in permanent loss of your ATOM.
      </Alert>
      <li>Establish an account name and password, then select Next.</li>
      <li>Confirm your mnemonic seed phrase and select Register.</li>
      <li>Done!</li>
    </ul>
  );
};
