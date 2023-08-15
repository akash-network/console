import React, { ReactNode } from "react";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { Address } from "./Address";

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
        <a>
          <Address address={address} addressBookMode={addressBookMode} disableTruncate />
        </a>
      </Link>
    );
  } else {
    return <Address address={address} disableTruncate isCopyable />;
  }
};
