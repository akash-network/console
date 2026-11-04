"use client";
import type { FC } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { CopyIcon } from "lucide-react";
import type { EnqueueSnackbar } from "notistack";

type Props = {
  secret: string;
  onCopy: (secret: string) => void;
};

export const ApiKeySecret: FC<Props> = ({ secret, onCopy }) => (
  <div className="flex items-center gap-2.5 rounded-lg border bg-muted px-3.5 py-3">
    <code aria-label="API key secret" className="amp-mask min-w-0 flex-1 break-all font-mono text-[12.5px] leading-[18px] text-foreground">
      {secret}
    </code>
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Copy to clipboard"
      className="h-[30px] w-[30px] shrink-0 rounded-md"
      onClick={() => onCopy(secret)}
    >
      <CopyIcon className="h-3.5 w-3.5" />
    </Button>
  </div>
);

export async function copyApiKeySecret(secret: string, enqueueSnackbar: EnqueueSnackbar) {
  const isCopied = await copyTextToClipboard(secret);

  if (isCopied) {
    enqueueSnackbar(<Snackbar title="Key copied to clipboard" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
  } else {
    enqueueSnackbar(<Snackbar title="Couldn't copy the key" subTitle="Select it and copy it yourself." iconVariant="error" />, { variant: "error" });
  }
}
