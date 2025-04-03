"use client";
import type { ReactNode } from "react";
import React from "react";
import { Address } from "@akashnetwork/ui/components";
import Link from "next/link";

import { UrlService } from "@/lib/urlUtils";

type Props = {
  address: string;
  children?: ReactNode;
};

export const AddressLink: React.FunctionComponent<Props> = ({ address }) => {
  let href = null;
  if (address.startsWith("akashvaloper")) {
    href = UrlService.validator(address);
  } else if (address.startsWith("akash")) {
    href = UrlService.address(address);
  }

  if (href) {
    return (
      <Link href={href}>
        <Address address={address} disableTruncate />
      </Link>
    );
  } else {
    return <Address address={address} disableTruncate isCopyable />;
  }
};
