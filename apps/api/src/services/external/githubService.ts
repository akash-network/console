import { Octokit } from "@octokit/rest";
import axios from "axios";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { Auditor, ProviderAttributesSchema } from "@src/types/provider";
import { env } from "@src/utils/env";

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

export const getProviderAttributesSchema = async (): Promise<ProviderAttributesSchema> => {
  // Fetching provider attributes schema
  const response = await cacheResponse(
    30,
    cacheKeys.getProviderAttributesSchema,
    async () => await axios.get<ProviderAttributesSchema>("https://raw.githubusercontent.com/akash-network/cloudmos/main/config/provider-attributes.json")
  );

  return response.data;
};

export async function getAuditors() {
  const response = await cacheResponse(60 * 5, cacheKeys.getAuditors, async () => {
    const res = await axios.get<Auditor[]>("https://raw.githubusercontent.com/akash-network/cloudmos/main/config/auditors.json");
    return res.data;
  });

  return response;
}
