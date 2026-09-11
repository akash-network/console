import { singleton } from "tsyringe";

import type { RotateDataKeysOptions } from "@src/secret/services/data-key-rotation/data-key-rotation.service";
import { DataKeyRotationService } from "@src/secret/services/data-key-rotation/data-key-rotation.service";

@singleton()
export class DataKeyRotationController {
  constructor(private readonly dataKeyRotationService: DataKeyRotationService) {}

  async rotate(options: RotateDataKeysOptions) {
    return this.dataKeyRotationService.rotate(options);
  }
}
