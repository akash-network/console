import React, { ReactNode } from "react";
import Link from "next/link";
import { Address } from "./Address";

type Props = {
  address: string;
  addressBookMode?: "always" | "never" | "alongside";
  children?: ReactNode;
};

export const AddressLink: React.FunctionComponent<Props> = ({ address, addressBookMode, ...rest }) => {
  let href = null;
  let target = "_self";
  if (address.startsWith("akashvaloper")) {
    href = `https://stats.akash.network/validators/${address}`;
    target = "_blank";
  } else if (address.startsWith("akash")) {
    href = `https://stats.akash.network/addresses/${address}`;
    target = "_blank";
  }

  if (href) {
    return (
      <Link href={href} target={target}>
        <Address address={address} addressBookMode={addressBookMode} disableTruncate />
      </Link>
    );
  } else {
    return <Address address={address} disableTruncate isCopyable />;
  }
};
