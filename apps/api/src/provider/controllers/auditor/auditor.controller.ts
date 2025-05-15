import { singleton } from "tsyringe";

import { AuditorService } from "@src/provider/services/auditors/auditors.service";

@singleton()
export class AuditorController {
  constructor(private readonly auditorService: AuditorService) {}

  async getAuditors() {
    return await this.auditorService.getAuditors();
  }
}
