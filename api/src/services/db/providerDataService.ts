import { Provider, ProviderAttribute } from "@shared/dbSchemas/akash";
import { getProviderAttributesSchema } from "@src/services/external/githubService";

export async function getProviderRegions() {
  const providerAttributesSchema = await getProviderAttributesSchema();
  const regions = providerAttributesSchema["location-region"].values;

  const providers = await Provider.findAll({
    attributes: ["owner"],
    include: [{ model: ProviderAttribute, attributes: ["value"], where: { key: "location-region" } }]
  });

  console.log(JSON.stringify(providers, null, 2));
  const result = regions.map((region) => {
    const filteredProviders = providers.filter((p) => p.providerAttributes.some((attr) => attr.value === region.key)).map((x) => x.owner);
    return { ...region, providers: filteredProviders };
  });

  return result;
}
