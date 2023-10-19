import { ReactNode } from "react";
import { Popup } from "../shared/Popup";
import { Box, Button, IconButton, Typography, useTheme } from "@mui/material";
import { useSnackbar } from "notistack";
import Editor from "@monaco-editor/react";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import FileCopy from "@mui/icons-material/FileCopy";
import { Snackbar } from "../shared/Snackbar";

type Props = {
  sdl: string;
  onClose: () => void;
  children?: ReactNode;
};

export const PreviewSdl: React.FunctionComponent<Props> = ({ sdl, onClose }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const onCopyClick = () => {
    copyTextToClipboard(sdl);
    enqueueSnackbar(<Snackbar title="SDL copied to clipboard!" iconVariant="success" />, {
      variant: "success",
      autoHideDuration: 3000
    });
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Preview SDL"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "right",
          onClick: onClose
        }
      ]}
      onClose={onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      <Box sx={{ display: "flex", alignItems: "center", marginBottom: ".5rem" }}>
        <Button color="secondary" variant="contained" endIcon={<FileCopy fontSize="small" />} onClick={onCopyClick}>
          Copy the SDL
        </Button>
      </Box>
      <Box sx={{ marginBottom: ".5rem" }}>
        <Editor height="500px" defaultLanguage="yaml" value={sdl} theme={theme.palette.mode === "dark" ? "vs-dark" : "light"} />
      </Box>
    </Popup>
  );
};
