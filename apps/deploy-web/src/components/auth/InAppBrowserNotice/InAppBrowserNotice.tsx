"use client";

import { useState } from "react";
import { Alert, AlertDescription, Button } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";

import type { InAppBrowser } from "@src/lib/in-app-browser/detectInAppBrowser";
import { UNNAMED_ANDROID_WEBVIEW } from "@src/lib/in-app-browser/detectInAppBrowser";

export const DEPENDENCIES = {
  Alert,
  AlertDescription,
  Button
};

interface Props {
  browser: InAppBrowser;
  dependencies?: typeof DEPENDENCIES;
}

type CopyOutcome = "idle" | "copied" | "failed";

const COPY_BUTTON_LABELS: Record<CopyOutcome, string> = {
  idle: "Copy link",
  copied: "Link copied",
  failed: "Couldn't copy the link"
};

export function InAppBrowserNotice({ browser, dependencies: d = DEPENDENCIES }: Props) {
  const [copyOutcome, setCopyOutcome] = useState<CopyOutcome>("idle");
  const browserName = browser === UNNAMED_ANDROID_WEBVIEW ? "this app's built-in browser" : `${browser}'s built-in browser`;

  const copyPageLink = async () => {
    const isCopied = await copyTextToClipboard(window.location.href);
    setCopyOutcome(isCopied ? "copied" : "failed");
  };

  return (
    <d.Alert variant="warning" className="flex flex-col gap-3">
      <d.AlertDescription>
        Google sign-in doesn&apos;t work in {browserName}. Open this page in Chrome or Safari to continue with Google, or sign in with GitHub or email here.
      </d.AlertDescription>
      <d.Button type="button" variant="outline" size="sm" onClick={copyPageLink}>
        {COPY_BUTTON_LABELS[copyOutcome]}
      </d.Button>
    </d.Alert>
  );
}
