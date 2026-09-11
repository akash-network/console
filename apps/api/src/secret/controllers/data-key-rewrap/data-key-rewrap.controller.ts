import { singleton } from "tsyringe";

import type { DataKeyRewrapOptions } from "@src/secret/services/data-key-rewrap/data-key-rewrap.service";
import { DataKeyRewrapService } from "@src/secret/services/data-key-rewrap/data-key-rewrap.service";

@singleton()
export class DataKeyRewrapController {
  constructor(private readonly dataKeyRewrapService: DataKeyRewrapService) {}

  async rewrapDataKeys(options: DataKeyRewrapOptions) {
    return await this.dataKeyRewrapService.rewrapDataKeys(options);
  }
}
