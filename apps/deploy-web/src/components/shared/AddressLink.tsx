"use client";
import type { ReactNode } from "react";
import React from "react";
import { Address } from "@akashnetwork/ui/components";
import Link from "next/link";

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
