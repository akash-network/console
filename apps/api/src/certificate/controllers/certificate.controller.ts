import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { CreateCertificateResponse } from "../http-schemas/create-certificate.schema";
import { CertificateService } from "../services/certificate/certificate.service";

@singleton()
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async create(): Promise<CreateCertificateResponse> {
    const cert = await this.certificateService.create({ userId: this.authService.currentUser.id });
    return { data: cert };
  }
}
