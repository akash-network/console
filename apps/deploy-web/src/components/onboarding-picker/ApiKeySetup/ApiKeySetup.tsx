"use client";

import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { Card, LoadingButton } from "@akashnetwork/ui/components";
import { format } from "date-fns";
import { KeyRound } from "lucide-react";
import { useSnackbar } from "notistack";

import { API_KEY_DATE_FORMAT } from "@src/components/api-keys/apiKeyExpiry/apiKeyExpiry";
import { ApiKeySecret, copyApiKeySecret } from "@src/components/api-keys/ApiKeySecret/ApiKeySecret";
import type { ApiKeyUsageTab } from "@src/components/api-keys/ApiKeyUsageGuide/ApiKeyUsageGuide";
import { ApiKeyUsageGuide } from "@src/components/api-keys/ApiKeyUsageGuide/ApiKeyUsageGuide";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { useServices } from "@src/context/ServicesProvider";

export const API_KEY_MASK = "ac.sk.••••••••••••";

const SECRET_SHOWN_ONCE = "Copy it now. It isn't shown again once you leave this page.";

export const DEPENDENCIES = { useServices, useSnackbar, ApiKeyUsageGuide };

type Props = {
  createdApiKey: ApiKeyResponse | undefined;
  isCreating: boolean;
  isLoadingTrialProject: boolean;
  onCreate: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export function ApiKeySetup({ createdApiKey, isCreating, isLoadingTrialProject, onCreate, dependencies: d = DEPENDENCIES }: Props) {
  const { analyticsService } = d.useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const secret = createdApiKey?.apiKey;

  function trackSetupCopied(tab: ApiKeyUsageTab) {
    analyticsService.track("onboarding_setup_copied", { category: "onboarding", tab, hasApiKey: !!secret });
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title="Create your API key">
        <Card className="flex flex-col gap-4 rounded-xl p-5 shadow-none sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {createdApiKey ? describeApiKey(createdApiKey) : "Shown once, then filled into the commands below."}
            </p>
            {!secret && (
              <LoadingButton loading={isCreating} disabled={isLoadingTrialProject} onClick={onCreate}>
                <KeyRound className="mr-2 h-4 w-4" aria-hidden />
                Create key
              </LoadingButton>
            )}
          </div>
          {secret && (
            <div className="flex flex-col gap-2">
              <ApiKeySecret secret={secret} onCopy={() => copyApiKeySecret(secret, enqueueSnackbar)} />
              <p className="text-[12.5px] leading-[18px] text-muted-foreground">{SECRET_SHOWN_ONCE}</p>
            </div>
          )}
        </Card>
      </SettingsSection>
      <d.ApiKeyUsageGuide title="Pick how you'll use it" apiKey={secret ?? API_KEY_MASK} onCommandCopied={trackSetupCopied} />
    </div>
  );
}

function describeApiKey({ name, expiresAt }: ApiKeyResponse) {
  return expiresAt ? `“${name}” · Expires ${format(new Date(expiresAt), API_KEY_DATE_FORMAT)}` : `“${name}”`;
}
