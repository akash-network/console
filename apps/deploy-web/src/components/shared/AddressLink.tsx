"use client";
import React, { ReactNode } from "react";
import Link from "next/link";

import { Address } from "./Address";

type Props = {
  address: string;
  children?: ReactNode;
};

export const AddressLink: React.FunctionComponent<Props> = ({ address }) => {
  let href: string | null = null;
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
        <Address address={address} disableTruncate />
      </Link>
    );
  } else {
    return <Address address={address} disableTruncate isCopyable />;
  }
};
