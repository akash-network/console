import { lighten, Box, IconButton } from "@mui/material";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import { useSnackbar } from "notistack";
import { useRef } from "react";
import { makeStyles } from "tss-react/mui";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { Snackbar } from "./Snackbar";
import { selectText } from "@src/utils/stringUtils";
import { grey } from "@mui/material/colors";

const useStyles = makeStyles()(theme => ({
  root: {
    position: "relative",
    padding: "1rem",
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.mode === "dark" ? grey[900] : lighten("#000", 0.9),
    fontSize: ".9rem"
  },
  actions: {
    position: "absolute",
    width: "100%",
    top: 0,
    left: 0,
    padding: theme.spacing(0.5),
    display: "flex",
    justifyContent: "flex-end"
  }
}));

export const CodeSnippet = ({ code }) => {
  const { classes } = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const codeRef = useRef<HTMLElement>();

  const onCopyClick = () => {
    copyTextToClipboard(code);
    enqueueSnackbar(<Snackbar title="Copied to clipboard!" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
  };

  const onCodeClick = () => {
    selectText(codeRef.current);
  };

  return (
    <pre className={classes.root}>
      <Box className={classes.actions}>
        <IconButton aria-label="copy" aria-haspopup="true" onClick={onCopyClick} size="small">
          <FileCopyIcon />
        </IconButton>
      </Box>
      <code ref={codeRef} onClick={onCodeClick}>
        {code}
      </code>
    </pre>
  );
};
