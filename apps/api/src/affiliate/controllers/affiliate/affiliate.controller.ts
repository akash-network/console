import { singleton } from "tsyringe";

import type { AffiliateProfileResponse } from "@src/affiliate/http-schemas/affiliate-profile.schema";
import { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import { AuthService, Protected } from "@src/auth/services/auth.service";

@singleton()
export class AffiliateController {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "read", subject: "Affiliate" }])
  async getProfile(): Promise<AffiliateProfileResponse> {
    const profile = await this.affiliateService.getProfile(this.authService.currentUser.id);
    return { data: profile };
  }
}
