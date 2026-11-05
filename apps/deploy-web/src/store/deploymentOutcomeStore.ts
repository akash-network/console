import { atomWithStorage, createJSONStorage } from "jotai/utils";

export type DeploymentOutcome = "live" | "failed";

export type KnownDeploymentOutcome = { outcome: DeploymentOutcome; failureReason?: string };

/** `unknown` is a deploy the api finished in the background, whose outcome the deployment page reads once it loads. */
export type RecordedDeploymentOutcome = { outcome: DeploymentOutcome | "unknown"; failureReason?: string; isPrompted?: boolean };

/** Kept per tab, so a deploy started here is asked about at most once a session and one started through the API or SDK never is. */
export const deploymentOutcomesAtom = atomWithStorage<Record<string, RecordedDeploymentOutcome>>(
  "console.feedback.deploymentOutcomes",
  {},
  createJSONStorage(() => sessionStorage)
);
