"use client";
import { useRef } from "react";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { selectText } from "@src/utils/stringUtils";
import { useToast } from "../ui/use-toast";
import { Button } from "../ui/button";
import { Copy } from "iconoir-react";

export const CodeSnippet = ({ code }: React.PropsWithChildren<{ code: string }>) => {
  const { toast } = useToast();
  const codeRef = useRef<HTMLElement>(null);

  const onCopyClick = () => {
    copyTextToClipboard(code);
    toast({ title: "Copied to clipboard!", variant: "success" });
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
