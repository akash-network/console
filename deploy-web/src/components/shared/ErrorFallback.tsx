"use client";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { makeStyles } from "tss-react/mui";
import { ReactNode } from "react";
import { FallbackProps } from "react-error-boundary";

interface Props extends FallbackProps {
  children?: ReactNode;
}

const useStyles = makeStyles()(theme => ({
  root: {
    width: "100%",
    height: "100%",
    display: "flex",
    padding: "2rem 0",
    flexDirection: "column",
    textAlign: "center",
    maxWidth: 300,
    margin: "0 auto"
  },
  heading: {
    marginBottom: "1.5rem",
    fontSize: "1.5rem",
    fontWeight: "bold"
  },
  alert: {
    marginBottom: "2rem",
    textAlign: "left"
  }
}));

export const ErrorFallback: React.FunctionComponent<Props> = ({ error, resetErrorBoundary }) => {
  const { classes } = useStyles();

  return (
    <div className={classes.root} role="alert">
      <Typography variant="h1" className={classes.heading}>
        Something went wrong
      </Typography>

      <Alert severity="error" variant="outlined" className={classes.alert}>
        <AlertTitle>Error</AlertTitle>
        {error.message}
      </Alert>

      <Button variant="contained" color="secondary" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
};
