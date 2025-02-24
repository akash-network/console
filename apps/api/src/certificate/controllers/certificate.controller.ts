import assert from "http-assert";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import { CreateCertificateResponse } from "../http-schemas/create-certificate.schema";
import { CertificateService } from "../services/certificate.service";

@singleton()
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Protected([{ action: "read", subject: "DeploymentSetting" }])
  async create(): Promise<CreateCertificateResponse> {
    const cert = await this.certificateService.create();
    assert(cert, 404, "Certificate not found");
    return cert;
  }
}
