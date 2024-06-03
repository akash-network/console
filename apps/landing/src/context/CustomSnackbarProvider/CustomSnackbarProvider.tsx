import React, { useRef } from "react";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { SnackbarKey, SnackbarProvider } from "notistack";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  root: {
    padding: "1rem",
    width: "360px !important",
    "& #notistack-snackbar": {
      paddingRight: "1rem"
    },
    "& .MuiCollapse-container": {
      width: "100%"
    }
  },
  success: {
    backgroundColor: ""
  },
  error: {
    backgroundColor: ""
  },
  warning: {
    backgroundColor: ""
  },
  info: {
    backgroundColor: ""
  },
  action: {
    position: "absolute",
    top: "4px",
    right: "4px",
    color: theme.palette.primary.contrastText
  }
}));

export const CustomSnackbarProvider = ({ children }) => {
  const notistackRef = useRef<SnackbarProvider>();
  const { classes } = useStyles();
  const onClickDismiss = (key: SnackbarKey) => () => {
    notistackRef.current.closeSnackbar(key);
  };

  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      ref={notistackRef}
      classes={{
        containerRoot: classes.root,
        variantSuccess: classes.success,
        variantError: classes.error,
        variantWarning: classes.warning,
        variantInfo: classes.info
      }}
      hideIconVariant
      dense
      action={key => (
        <Box width="2rem">
          <IconButton onClick={onClickDismiss(key)} size="small" className={classes.action}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    >
      {children}
    </SnackbarProvider>
  );
};
