import { singleton } from "tsyringe";

import type { VerifyAttestationRequest, VerifyAttestationResponse } from "../http-schemas/attestation.schema";
import { AttestationService } from "../services/attestation.service";

@singleton()
export class AttestationController {
  constructor(private readonly attestationService: AttestationService) {}

  async verify(request: VerifyAttestationRequest): Promise<VerifyAttestationResponse> {
    return await this.attestationService.verify(request);
  }
}
