import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { VerifyAttestationRequest, VerifyAttestationResponse } from "../http-schemas/attestation.schema";
import { AttestationService } from "../services/attestation.service";

@singleton()
export class AttestationController {
  constructor(private readonly attestationService: AttestationService) {}

  @Protected()
  async verify(request: VerifyAttestationRequest): Promise<VerifyAttestationResponse> {
    return await this.attestationService.verify(request);
  }
}
