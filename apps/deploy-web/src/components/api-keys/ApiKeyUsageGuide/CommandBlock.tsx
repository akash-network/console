"use client";
import type { FC } from "react";
import { Fragment } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { CopyIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { tokenizeShellLine } from "./tokenizeShellLine";

export const DEPENDENCIES = {
  useSnackbar
};

type Props = {
  label: string;
  lines: readonly string[];
  dependencies?: typeof DEPENDENCIES;
};

export const CommandBlock: FC<Props> = ({ label, lines, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();

  const copyCommands = async () => {
    const isCopied = await copyTextToClipboard(lines.join("\n"));

    if (isCopied) {
      enqueueSnackbar(<Snackbar title="Copied to clipboard" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't copy to your clipboard" subTitle="Select the text and copy it yourself." iconVariant="error" />, {
        variant: "error"
      });
    }
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted py-2 pl-4 pr-1.5">
      <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-xs leading-relaxed text-foreground">
        <code aria-label={label}>
          {lines.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 && "\n"}
              {tokenizeShellLine(line).map((token, tokenIndex) => (
                <span
                  key={tokenIndex}
                  data-token={token.kind}
                  className="data-[token=command]:text-emerald-700 data-[token=comment]:text-muted-foreground data-[token=string]:text-rose-700 dark:data-[token=command]:text-emerald-400 dark:data-[token=string]:text-red-300"
                >
                  {token.text}
                </span>
              ))}
            </Fragment>
          ))}
        </code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Copy ${label}`}
        className="h-7 w-7 shrink-0 rounded-md text-muted-foreground"
        onClick={copyCommands}
      >
        <CopyIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
