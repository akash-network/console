"use client";
import type { ReactNode } from "react";
import { Button, Popup, Snackbar } from "@akashnetwork/ui/components";
import { Copy } from "iconoir-react";
import { useTheme } from "next-themes";
import { useSnackbar } from "notistack";

import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { SDLEditor } from "./SDLEditor/SDLEditor";

type Props = {
  sdl: string;
  onClose: () => void;
  children?: ReactNode;
};

export const PreviewSdl: React.FunctionComponent<Props> = ({ sdl, onClose }) => {
  const { resolvedTheme } = useTheme();
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
        <SDLEditor height="500px" value={sdl} theme={resolvedTheme === "dark" ? "vs-dark" : "light"} readonly={true} />
      </div>
    </Popup>
  );
};
