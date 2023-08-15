import React from "react";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { Alert } from "@mui/material";
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()(theme => ({}));

export type Props = {
  message: string;
};

export const MustConnect: React.FunctionComponent<Props> = ({ message }) => {
  return (
    <Alert severity="info" variant="outlined">
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
