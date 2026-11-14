import { singleton } from "tsyringe";

import type { GetReferralCodeResponse, ReferralResponse } from "@src/affiliate/http-schemas/referral.schema";
import { ReferralService } from "@src/affiliate/services/referral/referral.service";
import { AuthService, Protected } from "@src/auth/services/auth.service";

@singleton()
export class ReferralController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "read", subject: "Affiliate" }])
  async getReferral(): Promise<ReferralResponse> {
    const referral = await this.referralService.getReferral(this.authService.currentUser.id);
    return { data: referral };
  }

  async checkCode(code: string): Promise<GetReferralCodeResponse> {
    return { data: await this.referralService.checkCode(code) };
  }
}
