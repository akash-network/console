import { cx } from "@emotion/css";
import { Box } from "@mui/material";
import React from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  root: {
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
    display: "inline-flex",
    margin: 0,
    padding: 0,
    color: theme.palette.secondary.main,
    "&:visited": {
      color: theme.palette.secondary.dark
    },
    "&:disabled": {
      color: theme.palette.grey[500],
      cursor: "initial"
    }
  }
}));

export const LinkTo = ({ children, ...rest }) => {
  const { classes } = useStyles();
  return (
    <Box component="button" type="button" {...rest} className={cx(rest?.className, classes.root)}>
      {children}
    </Box>
  );
};
