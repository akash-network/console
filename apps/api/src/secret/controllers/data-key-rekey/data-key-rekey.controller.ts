import { singleton } from "tsyringe";

import type { DataKeyRekeyOptions } from "@src/secret/services/data-key-rekey/data-key-rekey.service";
import { DataKeyRekeyService } from "@src/secret/services/data-key-rekey/data-key-rekey.service";

@singleton()
export class DataKeyRekeyController {
  constructor(private readonly dataKeyRekeyService: DataKeyRekeyService) {}

  async rekeyUser(options: DataKeyRekeyOptions) {
    return await this.dataKeyRekeyService.rekeyUser(options);
  }
}
