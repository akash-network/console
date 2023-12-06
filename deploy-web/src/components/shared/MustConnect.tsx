import React from "react";
import { Alert } from "@mui/material";

export type Props = {
  message: string;
};

export const MustConnect: React.FunctionComponent<Props> = ({ message }) => {
  return (
    <Alert severity="info" variant="outlined">
      {/* {message}, please{" "}
      <Link href={UrlService.login()} passHref>
        login
      </Link>{" "}
      or{" "}
      <Link href={UrlService.signup()} passHref>
        register
      </Link>
      . */}
      User accounts are currently disabled.
    </Alert>
  );
};
