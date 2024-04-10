"use client"
import { ReactNode } from "react";
import Editor from "@monaco-editor/react";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { useToast } from "@src/components/ui/use-toast";
import { Popup } from "@src/components/shared/Popup";
import { Button } from "@src/components/ui/button";
import { Copy } from "iconoir-react";
import { useTheme } from "next-themes";

type Props = {
  sdl: string;
  onClose: () => void;
  children?: ReactNode;
};

export const PreviewSdl: React.FunctionComponent<Props> = ({ sdl, onClose }) => {
  const { toast } = useToast();
  const { theme } = useTheme();

  const onCopyClick = () => {
    copyTextToClipboard(sdl);
    toast({title: "SDL copied to clipboard!", variant: "success"});
    // enqueueSnackbar(<Snackbar title="SDL copied to clipboard!" iconVariant="success" />, {
    //   variant: "success",
    //   autoHideDuration: 3000
    // });
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
      <div className="flex items-center mb-2">
        <Button color="secondary" variant="default" onClick={onCopyClick}>
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
