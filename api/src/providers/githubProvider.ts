import { Octokit } from "@octokit/rest";
import { env } from "@src/shared/utils/env";

export function getOctokit() {
  const githubPAT = env.AkashlyticsGithubPAT;

  if (!githubPAT) {
    throw new Error("AkashlyticsGithubPAT is missing");
  }

  return new Octokit({
    auth: githubPAT,
    userAgent: "Cloudmos API",
    baseUrl: "https://api.github.com"
  });
}
