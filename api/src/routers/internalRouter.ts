import { Provider, ProviderSnapshot } from "@shared/dbSchemas/akash";
import { chainDb } from "@src/db/dbConnection";
import { round } from "@src/utils/math";
import { Hono } from "hono";
import * as semver from "semver";
import { QueryTypes } from "sequelize";

export const internalRouter = new Hono();

internalRouter.get("/provider-versions", async (c) => {
  const providers = await Provider.findAll({
    attributes: ["hostUri", "akashVersion"],
    where: {
      isOnline: true
    },
    group: ["hostUri", "akashVersion"]
  });

  let grouped: { version: string; providers: string[] }[] = [];

  for (const provider of providers) {
    const existing = grouped.find((x) => x.version === provider.akashVersion);

    if (existing) {
      existing.providers.push(provider.hostUri);
    } else {
      grouped.push({
        version: provider.akashVersion,
        providers: [provider.hostUri]
      });
    }
  }

  const nullVersionName = "<UNKNOWN>";
  const results = grouped.map((x) => ({
    version: x.version ?? nullVersionName,
    count: x.providers.length,
    ratio: round(x.providers.length / providers.length, 2),
    providers: Array.from(new Set(x.providers))
  }));

  const sorted = results
    .filter((x) => x.version !== nullVersionName) // Remove <UNKNOWN> version for sorting
    .sort((a, b) => semver.compare(b.version, a.version))
    .concat(results.filter((x) => x.version === nullVersionName)) // Add back <UNKNOWN> version at the end
    .reduce((acc, x) => {
      acc[x.version] = x;
      return acc;
    }, {} as any);

  return c.json(sorted);
});

internalRouter.get("/gpu-models", async (c) => {
  const results = (await chainDb.query(
    `
WITH "gpus" AS (
	SELECT DISTINCT ON("hostUri") "hostUri", psng.*
	FROM provider p
	INNER JOIN "providerSnapshot" ps ON ps.id=p."lastSnapshotId"
	INNER JOIN "providerSnapshotNode" psn ON psn."snapshotId"=ps.id
	INNER JOIN "providerSnapshotNodeGPU" psng ON psng."snapshotNodeId"=psn.id
	WHERE p."isOnline" IS TRUE
) 
SELECT "vendor","name","interface","memorySize", COUNT(*)
FROM "gpus"
GROUP BY "vendor","name","interface","memorySize"
`,
    { type: QueryTypes.SELECT }
  )) as { vendor: string; name: string; interface: string; memorySize: string; count: number }[];

  const response = {
    count: results.map((x) => x.count).reduce((a, b) => a + b, 0),
    vendors: {}
  };

  const uniqueVendors = new Set(results.map((x) => x.vendor));

  for (const vendor of uniqueVendors) {
    const vendorGpus = results.filter((x) => x.vendor === vendor);
    const uniqueModels = new Set(vendorGpus.map((x) => x.name));

    response.vendors[vendor] = {
      count: vendorGpus.map((x) => x.count).reduce((a, b) => a + b, 0),
      models: {}
    };

    for (const model of uniqueModels) {
      const modelGpus = vendorGpus.filter((x) => x.name === model);
      response.vendors[vendor].models[model] = {
        count: modelGpus.map((x) => x.count).reduce((a, b) => a + b, 0),
        memory: {}
      };

      const uniqueMemorySizes = new Set(modelGpus.map((x) => x.memorySize));
      for (const memorySize of uniqueMemorySizes) {
        const memorySizeGpus = modelGpus.filter((x) => x.memorySize === memorySize);
        response.vendors[vendor].models[model].memory[memorySize] = memorySizeGpus.map((x) => x.count).reduce((a, b) => a + b, 0);
      }
    }
  }

  return c.json(response);
});
