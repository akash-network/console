import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Provider } from "@shared/dbSchemas/akash";
import { round } from "@src/utils/math";
import * as semver from "semver";

const route = createRoute({
  method: "get",
  path: "/provider-versions",
  summary: "Get providers grouped by version.",
  responses: {
    200: {
      description: "List of providers grouped by version.",
      content: {
        "application/json": {
          schema: z.record(
            z.string(),
            z.object({
              version: z.string(),
              count: z.number(),
              ratio: z.number(),
              providers: z.array(z.string())
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const providers = await Provider.findAll({
    attributes: ["hostUri", "akashVersion"],
    where: {
      isOnline: true
    },
    group: ["hostUri", "akashVersion"]
  });

  const grouped: { version: string; providers: string[] }[] = [];

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
    .reduce(
      (acc, x) => {
        acc[x.version] = x;
        return acc;
      },
      {} as { [key: string]: (typeof results)[number] }
    );

  return c.json(sorted);
});
