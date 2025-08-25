import type { ProviderAttributesSchema } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { ProviderAttributesSchemaService } from "@src/provider/services/provider-attributes-schema/provider-attributes-schema.service";

@singleton()
export class ProviderAttributesSchemaController {
  constructor(private readonly providerAttributesSchemaService: ProviderAttributesSchemaService) {}

  async getProviderAttributesSchema(): Promise<ProviderAttributesSchema> {
    return await this.providerAttributesSchemaService.getProviderAttributesSchema();
  }
}
