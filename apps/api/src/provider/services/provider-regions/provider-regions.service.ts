import { Provider, ProviderAttribute } from "@akashnetwork/database/dbSchemas/akash";
import { minutesToSeconds } from "date-fns";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { ProviderAttributesSchemaService } from "../provider-attributes-schema/provider-attributes-schema.service";

@singleton()
export class ProviderRegionsService {
  constructor(private readonly providerAttributesSchemaService: ProviderAttributesSchemaService) {}

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getProviderRegions() {
    const providerAttributesSchema = await this.providerAttributesSchemaService.getProviderAttributesSchema();
    if (!providerAttributesSchema["location-region"]) {
      return [];
    }

    const regions = providerAttributesSchema["location-region"].values || [];

    const providers = await Provider.findAll({
      attributes: ["owner"],
      include: [{ model: ProviderAttribute, attributes: ["value"], where: { key: "location-region" } }]
    });

    const providersByRegion = providers.reduce((acc: Record<string, string[]>, provider) => {
      provider.providerAttributes.forEach(regionAttribute => {
        if (!acc[regionAttribute.value]) {
          acc[regionAttribute.value] = [];
        }

        acc[regionAttribute.value].push(provider.owner);
      });

      return acc;
    }, {});

    return regions.map(region => {
      return { ...region, providers: providersByRegion[region.key] || [] };
    });
  }
}
