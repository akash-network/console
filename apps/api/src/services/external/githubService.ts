import { Octokit } from "@octokit/rest";
import axios from "axios";
import minutesToSeconds from "date-fns/minutesToSeconds";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { Auditor, ProviderAttributesSchema } from "@src/types/provider";
import { env } from "@src/utils/env";

export function getOctokit() {
  const githubPAT = env.GITHUB_PAT;

  if (!githubPAT) {
    throw new Error("GITHUB_PAT is missing");
  }

  return new Octokit({
    auth: githubPAT,
    userAgent: "Console API",
    baseUrl: "https://api.github.com"
  });
}

export const getProviderAttributesSchema = async (): Promise<ProviderAttributesSchema> => {
  // Fetching provider attributes schema
  const response = await cacheResponse(
    minutesToSeconds(5),
    cacheKeys.getProviderAttributesSchema,
    async () => await axios.get<ProviderAttributesSchema>("https://raw.githubusercontent.com/akash-network/console/main/config/provider-attributes.json"),
    true
  );

  return response.data;
};

export async function getAuditors() {
  const response = await cacheResponse(
    minutesToSeconds(5),
    cacheKeys.getAuditors,
    async () => {
      const res = await axios.get<Auditor[]>("https://raw.githubusercontent.com/akash-network/console/main/config/auditors.json");
      return res.data;
    },
    true
  );

  return response;
}
