"use client";
import React from "react";
import { Alert } from "@akashnetwork/ui/components";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export type Props = {
  message: string;
};

export const MustConnect: React.FunctionComponent<Props> = ({ message }) => {
  return (
    <Alert>
      {message}, please{" "}
      <Link href={UrlService.login()} passHref>
        login
      </Link>{" "}
      or{" "}
      <Link href={UrlService.signup()} passHref>
        register
      </Link>
      .
    </Alert>
  );
};
