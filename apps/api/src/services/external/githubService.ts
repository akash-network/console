import { Octokit } from "@octokit/rest";

export function getOctokit(githubPAT: string) {
  if (!githubPAT) {
    throw new Error("GITHUB_PAT is missing");
  }

  return new Octokit({
    auth: githubPAT,
    userAgent: "Console API",
    baseUrl: "https://api.github.com"
  });
}
