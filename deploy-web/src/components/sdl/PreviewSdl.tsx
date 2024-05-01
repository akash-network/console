"use client";
import { ReactNode } from "react";
import Editor from "@monaco-editor/react";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { Popup } from "@src/components/shared/Popup";
import { Button } from "@src/components/ui/button";
import { Copy } from "iconoir-react";
import { useTheme } from "next-themes";
import { useSnackbar } from "notistack";
import { Snackbar } from "../shared/Snackbar";

type Props = {
  sdl: string;
  onClose: () => void;
  children?: ReactNode;
};

export const PreviewSdl: React.FunctionComponent<Props> = ({ sdl, onClose }) => {
  const { theme } = useTheme();
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
      <div className="mb-4 flex items-center">
        <Button color="secondary" variant="default" onClick={onCopyClick} size="sm">
          Copy the SDL
          <Copy className="ml-2 text-sm" />
        </Button>
      </div>
      <div className="mb-2">
        <Editor height="500px" defaultLanguage="yaml" value={sdl} theme={theme === "dark" ? "vs-dark" : "light"} />
      </div>
    </Popup>
  );
};
