import React, { ReactNode } from "react";
import Link from "next/link";
import { Address } from "./Address";
import { UrlService } from "@/lib/urlUtils";

type Props = {
  address: string;
  addressBookMode?: "always" | "never" | "alongside";
  children?: ReactNode;
};

export const AddressLink: React.FunctionComponent<Props> = ({ address, addressBookMode, ...rest }) => {
  let href = null;
  if (address.startsWith("akashvaloper")) {
    href = UrlService.validator(address);
  } else if (address.startsWith("akash")) {
    href = UrlService.address(address);
  }

  if (href) {
    return (
      <Link href={href}>
        <Address address={address} addressBookMode={addressBookMode} disableTruncate />
      </Link>
    );
  } else {
    return <Address address={address} disableTruncate isCopyable />;
  }
};
