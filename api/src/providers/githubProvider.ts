import { Octokit } from "@octokit/rest";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { chainDb } from "@src/db/dbConnection";
import { ProviderAttributesSchema } from "@src/types/provider";
import { env } from "@src/utils/env";
import axios from "axios";
import { QueryTypes } from "sequelize";

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
    async () => await axios.get("https://raw.githubusercontent.com/akash-network/cloudmos/main/config/provider-attributes.json")
  );

  return response.data;
};

export async function getAuditors() {
  const response = await cacheResponse(60 * 5, cacheKeys.getAuditors, async () => {
    const res = await axios.get("https://raw.githubusercontent.com/akash-network/cloudmos/main/config/auditors.json");
    return res.data;
  });

  return response;
}

export async function getProviderRegions() {
  const providerAttributesSchema = await getProviderAttributesSchema();
  const regions = providerAttributesSchema["location-region"].values;

  let result: { owner: string; location_region: string }[] = await chainDb.query(
    `SELECT p.owner, pa.value AS location_region
    FROM public."provider" p
    JOIN public."providerAttribute" pa ON p.owner = pa.provider
    WHERE pa.key = 'location-region';`,
    {
      type: QueryTypes.SELECT
    }
  );

  const res = regions.map((region) => {
    const providers = result.filter((provider) => provider.location_region === region.key).map((provider) => provider.owner);
    return { ...region, providers };
  });

  return res;
}
