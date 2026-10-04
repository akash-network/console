"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { Check, Copy } from "lucide-react";

const COPIED_FEEDBACK_MS = 1400;

type Props = {
  value: string;
  display: string;
  label: string;
};

export const CopyChip: FC<Props> = ({ value, display, label }) => {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(
    function clearCopiedFeedback() {
      if (!isCopied) return;
      const timeoutId = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
      return function cancelCopiedFeedback() {
        clearTimeout(timeoutId);
      };
    },
    [isCopied]
  );

  const copyValue = async () => {
    setIsCopied(await copyTextToClipboard(value));
  };

  return (
    <button
      type="button"
      onClick={copyValue}
      aria-label={isCopied ? `${label}, copied` : label}
      title={value}
      className="inline-flex h-[26px] min-w-0 max-w-[300px] items-center gap-1.5 rounded-lg border bg-muted px-2 font-mono text-[11.5px] text-foreground transition-colors hover:bg-card"
    >
      <span className="truncate">{display}</span>
      {isCopied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </button>
  );
};
