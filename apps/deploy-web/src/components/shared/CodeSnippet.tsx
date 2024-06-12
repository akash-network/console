"use client";
import { useRef } from "react";
import { Copy } from "iconoir-react";
import { useSnackbar } from "notistack";

import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { selectText } from "@src/utils/stringUtils";
import { Button } from "@akashnetwork/ui/components";
import { Snackbar } from "./Snackbar";

export const CodeSnippet = ({ code }: React.PropsWithChildren<{ code: string }>) => {
  const { enqueueSnackbar } = useSnackbar();
  const codeRef = useRef<HTMLElement>(null);

  const onCopyClick = () => {
    copyTextToClipboard(code);
    enqueueSnackbar(<Snackbar title="Copied to clipboard!" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
  };

  const onCodeClick = () => {
    if (codeRef?.current) selectText(codeRef.current);
  };

  return (
    <pre className="relative rounded-sm bg-popover p-4 pt-6 text-sm">
      <div className="absolute left-0 top-0 flex w-full justify-end p-2">
        <Button aria-label="copy" aria-haspopup="true" onClick={onCopyClick} size="icon" variant="ghost">
          <Copy />
        </Button>
      </div>
      <code ref={codeRef} onClick={onCodeClick} className="whitespace-pre-wrap break-words">
        {code}
      </code>
    </pre>
  );
};
