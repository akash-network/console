import { singleton } from "tsyringe";

import type { Auditor } from "@src/provider/http-schemas/auditor.schema";

const AUDITORS: Auditor[] = [
  {
    id: "akash-network",
    name: "Akash Network",
    address: "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63",
    website: "https://akash.network"
  }
];

@singleton()
export class AuditorService {
  getAuditors(): Auditor[] {
    return AUDITORS;
  }
}
