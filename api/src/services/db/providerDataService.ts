import { Provider, ProviderAttribute } from "@shared/dbSchemas/akash";
import { getProviderAttributesSchema } from "@src/services/external/githubService";

export async function getProviderRegions() {
  const providerAttributesSchema = await getProviderAttributesSchema();
  const regions = providerAttributesSchema["location-region"].values;

  const providerRegions = await Provider.findAll({
    attributes: ["owner"],
    include: [{ model: ProviderAttribute, attributes: [["value", "location_region"]], where: { key: "location-region" } }],
    raw: true
  });

  const result = regions.map((region) => {
    const providers = providerRegions.filter((x) => x["providerAttributes.location_region"] === region.key).map((x) => x.owner);
    return { ...region, providers };
  });

  return result;
}
