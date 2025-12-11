"use client";
import React from "react";
import { Alert } from "@akashnetwork/ui/components";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";
import { SignUpButton } from "../auth/SignUpButton/SignUpButton";

export type Props = {
  message: string;
};

export const MustConnect: React.FunctionComponent<Props> = ({ message }) => {
  return (
    <Alert>
      {message}, please{" "}
      <Link href={UrlService.newLogin()} passHref prefetch={false}>
        login
      </Link>{" "}
      or <SignUpButton>register</SignUpButton>.
    </Alert>
  );
};
