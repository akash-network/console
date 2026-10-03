"use client";
import type { FC } from "react";
import { Fragment } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { CopyIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { tokenizeShellLine } from "./tokenizeShellLine";

export const DEPENDENCIES = {
  useSnackbar
};

export const API_KEY_USAGE_SCRIPT_LINES = [
  "# Authenticate every request with the x-api-key header",
  'export AKASH_API_KEY="<your-api-key>"',
  "API=https://console-api.akash.network",
  "",
  "# 1. Create a deployment from deploy.yaml. Your account credits fund it.",
  'DSEQ=$(curl -s -X POST "$API/v1/deployments" \\',
  '  -H "x-api-key: $AKASH_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  `  -d "$(jq -n --rawfile sdl deploy.yaml '{ data: { sdl: $sdl } }')" | jq -r '.data.dseq')`,
  "",
  "# 2. Wait for providers to bid",
  'until BID=$(curl -s "$API/v1/bids?dseq=$DSEQ" \\',
  `    -H "x-api-key: $AKASH_API_KEY" | jq -ce '.data[0].bid.id'); do`,
  "  sleep 3",
  "done",
  "",
  "# 3. Accept the first bid to start the lease",
  'curl -s -X POST "$API/v1/leases" \\',
  '  -H "x-api-key: $AKASH_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  `  -d "$(jq -n --argjson bid "$BID" '{ leases: [$bid | { dseq, gseq, oseq, provider }] }')"`,
  "",
  "# 4. Close the deployment when you're done. Unspent funds go back to your account.",
  'curl -s -X DELETE "$API/v1/deployments/$DSEQ" \\',
  '  -H "x-api-key: $AKASH_API_KEY"'
];

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const ApiKeyUsageExample: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();

  const copyScript = async () => {
    const isCopied = await copyTextToClipboard(API_KEY_USAGE_SCRIPT_LINES.join("\n"));

    if (isCopied) {
      enqueueSnackbar(<Snackbar title="Script copied to clipboard" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't copy the script" subTitle="Select it and copy it yourself." iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <SettingsSection
      title="Using your keys"
      aside={
        <Button type="button" variant="ghost" size="xs" className="gap-1.5 text-xs text-muted-foreground" onClick={copyScript}>
          <CopyIcon className="h-3.5 w-3.5" aria-hidden />
          Copy script
        </Button>
      }
    >
      <pre className="overflow-x-auto rounded-xl border bg-muted px-[18px] py-4 font-mono text-xs leading-relaxed text-foreground">
        <code aria-label="API key usage script">
          {API_KEY_USAGE_SCRIPT_LINES.map((line, lineIndex) => (
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
    </SettingsSection>
  );
};
