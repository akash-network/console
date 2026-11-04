import { useCallback } from "react";
import { Button, GithubLogo, Snackbar } from "@akashnetwork/ui/components";
import type { CloseReason } from "notistack";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export const CONSOLE_REPOSITORY_URL = "https://github.com/akash-network/console";

const GITHUB_STAR_PROMPT_KEY = "github-star-prompt";

export const DEPENDENCIES = {
  useUser,
  useSnackbar
};

/** Asks once per account; a profile that loaded without the timestamp is never prompted, since only an explicit null means the user has not answered yet. */
export function useGithubStarPrompt(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api, analyticsService } = useServices();
  const { user, checkSession } = dependencies.useUser();
  const { enqueueSnackbar, closeSnackbar } = dependencies.useSnackbar();
  const { mutate: markPrompted } = api.v1.markGithubStarPrompted.useMutation({
    onSuccess: () => checkSession()
  });
  const hasNeverAnswered = user?.githubStarPromptedAt === null;

  return useCallback(() => {
    if (!hasNeverAnswered) return;

    let hasStarred = false;

    function star() {
      hasStarred = true;
      analyticsService.track("github_star_prompt_clicked", { category: "user" });
      closeSnackbar(GITHUB_STAR_PROMPT_KEY);
    }

    function recordAnswer(_event: unknown, reason: CloseReason) {
      if (reason === "maxsnack") return;
      if (!hasStarred) analyticsService.track("github_star_prompt_dismissed", { category: "user" });
      markPrompted();
    }

    analyticsService.track("github_star_prompt_shown", { category: "user" });
    enqueueSnackbar(
      <Snackbar
        iconVariant="success"
        title="Your deployment is live"
        subTitle={
          <>
            <p>Console is open source. If it helped, a GitHub star helps other builders find it.</p>
            <Button asChild size="sm" className="mt-2 gap-2">
              <a href={CONSOLE_REPOSITORY_URL} target="_blank" rel="noopener noreferrer" onClick={star}>
                <GithubLogo className="h-4 w-4" />
                Star on GitHub
              </a>
            </Button>
          </>
        }
      />,
      { key: GITHUB_STAR_PROMPT_KEY, preventDuplicate: true, persist: true, onClose: recordAnswer }
    );
  }, [hasNeverAnswered, analyticsService, enqueueSnackbar, closeSnackbar, markPrompted]);
}
