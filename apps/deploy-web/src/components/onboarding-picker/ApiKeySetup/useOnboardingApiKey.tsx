import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { DEFAULT_API_KEY_LIFETIME_DAYS, getApiKeyExpiryDate } from "@src/components/api-keys/apiKeyExpiry/apiKeyExpiry";
import { useServices } from "@src/context/ServicesProvider";
import { useProjectsUi } from "@src/hooks/useProjectsUi/useProjectsUi";
import { useCreateApiKey } from "@src/queries/useApiKeysQuery";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";

export const ONBOARDING_API_KEY_NAME = "My first key";

export const DEPENDENCIES = { useServices, useSnackbar, useProjectsUi, useProjectsQuery, useCreateApiKey };

/** Onboarding only renders in the personal organization, whose default project is the one the trial deploys into. */
export function useOnboardingApiKey({ enabled }: { enabled: boolean }, d: typeof DEPENDENCIES = DEPENDENCIES) {
  const { analyticsService } = d.useServices();
  const { enqueueSnackbar } = d.useSnackbar();
  const { isEnabled: isProjectsUiEnabled } = d.useProjectsUi();
  const { data: projects, isLoading: isLoadingTrialProject } = d.useProjectsQuery({ enabled: enabled && isProjectsUiEnabled });
  const { mutate, data: createdApiKey, isPending: isCreating } = d.useCreateApiKey();
  const trialProjectId = projects?.find(project => project.isDefault)?.id;

  function createApiKey() {
    const expiresAt = getApiKeyExpiryDate(DEFAULT_API_KEY_LIFETIME_DAYS, new Date());

    mutate(
      { name: ONBOARDING_API_KEY_NAME, expiresAt, projectId: trialProjectId },
      {
        onSuccess: () => analyticsService.track("create_api_key", { category: "onboarding", label: "Create API key" }),
        onError: () =>
          enqueueSnackbar(<Snackbar title="Couldn't create the API key" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" })
      }
    );
  }

  return { createApiKey, createdApiKey, isCreating, isLoadingTrialProject };
}
