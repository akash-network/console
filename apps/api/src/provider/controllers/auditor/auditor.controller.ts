import { singleton } from "tsyringe";

import { AuditorService } from "@src/provider/services/auditors/auditors.service";

@singleton()
export class AuditorController {
  constructor(private readonly auditorService: AuditorService) {}

  getAuditors() {
    return this.auditorService.getAuditors();
  }
}
