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
    const regions = providerAttributesSchema["location-region"].values;

    const providers = await Provider.findAll({
      attributes: ["owner"],
      include: [{ model: ProviderAttribute, attributes: ["value"], where: { key: "location-region" } }]
    });

    return regions.map(region => {
      const filteredProviders = providers.filter(p => p.providerAttributes.some(attr => attr.value === region.key)).map(x => x.owner);
      return { ...region, providers: filteredProviders };
    });
  }
}
