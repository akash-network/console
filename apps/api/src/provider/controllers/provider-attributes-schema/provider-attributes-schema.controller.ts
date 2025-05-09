import { singleton } from "tsyringe";

import { ProviderAttributesSchemaService } from "@src/provider/services/provider-attributes-schema/provider-attributes-schema.service";

@singleton()
export class ProviderAttributesSchemaController {
  constructor(private readonly providetAttributesSchemaService: ProviderAttributesSchemaService) {}

  async getProviderAttributesSchema() {
    return await this.providetAttributesSchemaService.getProviderAttributesSchema();
  }
}
